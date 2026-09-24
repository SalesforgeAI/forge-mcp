import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

/** Start an isolated Node process and collect structured diagnostic output. */
function launch(args, env = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, LOG_LEVEL: "debug", SLOW_REQUEST_MS: "80", RUNTIME_LOG_INTERVAL_MS: "100", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  let stderr = "";
  let stdout = "";
  let pending = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop();
    for (const line of lines) {
      try { logs.push(JSON.parse(line)); } catch { /* Node/Express can emit native diagnostics. */ }
    }
  });
  return { child, logs, stderr: () => stderr, stdout: () => stdout };
}

/** Wait for a diagnostic matching a predicate with a bounded test deadline. */
async function waitFor(logs, predicate) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const entry = logs.find(predicate);
    if (entry) return entry;
    await delay(20);
  }
  assert.fail(`Missing diagnostic: ${predicate}`);
}

test("HTTP logs correlate health, parser errors, slow bodies and disconnects", { timeout: 10000 }, async (t) => {
  const run = launch(["dist/http.js"], { PORT: "0", NODE_ENV: "production" });
  t.after(async () => {
    if (run.child.exitCode !== null || run.child.signalCode !== null) return;
    const exited = once(run.child, "exit");
    run.child.kill();
    await exited;
  });
  const listening = await waitFor(run.logs, (entry) => entry.event === "http.server.listening");
  const base = `http://127.0.0.1:${listening.port}`;
  const health = await fetch(`${base}/health?secret=DO_NOT_LOG`, { headers: { "X-Salesforge-Key": "DO_NOT_LOG" } });
  assert.deepEqual(await health.json(), { status: "ok" });
  const requestId = health.headers.get("x-request-id");
  assert.ok(requestId);
  await waitFor(run.logs, (entry) => entry.event === "http.request.completed" && entry.requestId === requestId);
  assert.ok(run.logs.some((entry) => entry.event === "http.request.started" && entry.requestId === requestId));
  const unauthorized = await fetch(`${base}/mcp`, { method: "POST" });
  assert.equal(unauthorized.status, 401);
  const malformed = await fetch(`${base}/mcp`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  });
  assert.equal(malformed.status, 400);
  await waitFor(run.logs, (entry) => entry.event === "http.request.failed");

  const socket = net.connect(listening.port, "127.0.0.1");
  t.after(() => socket.destroy());
  await once(socket, "connect");
  socket.write("POST /mcp HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{");
  const slow = await waitFor(run.logs, (entry) => entry.event === "http.request.slow");
  socket.destroy();
  const aborted = await waitFor(run.logs, (entry) => entry.event === "http.request.aborted" && entry.requestId === slow.requestId);
  assert.equal(aborted.activeRequests, 0);
  assert.equal(run.logs.filter((entry) => entry.requestId === slow.requestId && ["http.request.aborted", "http.request.completed"].includes(entry.event)).length, 1);
  await waitFor(run.logs, (entry) => entry.event === "runtime.metrics");
  assert.equal(run.stderr().includes("DO_NOT_LOG"), false);
  assert.equal(run.stdout(), "");
});

test("upstream logs cover body stalls, API errors, network errors and raw downloads without payloads", async () => {
  const run = launch(["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { ApiClient } from './dist/api-client.js';
    import { SalesforgeClient } from './dist/client.js';
    const api = new ApiClient('DO_NOT_LOG', 'https://example.com', 'Example');
    const sf = new SalesforgeClient('DO_NOT_LOG');
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) { setTimeout(() => { controller.enqueue(new TextEncoder().encode('{}')); controller.close(); }, 160); }
    }));
    assert.deepEqual(await api.get('/DO_NOT_LOG', { secret: 'DO_NOT_LOG' }), {});
    globalThis.fetch = async () => new Response('DO_NOT_LOG', { status: 503 });
    await assert.rejects(sf.coreGet('/DO_NOT_LOG'), { statusCode: 503 });
    globalThis.fetch = async () => { throw new TypeError('DO_NOT_LOG'); };
    await assert.rejects(api.get('/secret'), TypeError);
    globalThis.fetch = async () => new Response('DO_NOT_LOG');
    await assert.rejects(api.get('/secret'), SyntaxError);
    globalThis.fetch = async () => new Response('download');
    assert.equal((await sf.coreGetRaw('/secret')).data, Buffer.from('download').toString('base64'));
  `]);
  const [code] = await once(run.child, "exit");
  assert.equal(code, 0, run.stderr());
  assert.equal(run.logs.filter((entry) => entry.event === "upstream.request.started").length, 5);
  assert.equal(run.logs.filter((entry) => entry.event === "upstream.request.completed").length, 2);
  assert.equal(run.logs.filter((entry) => entry.event === "upstream.request.failed").length, 3);
  assert.ok(run.logs.some((entry) => entry.event === "upstream.request.slow" && entry.statusCode === 200));
  assert.equal(run.stderr().includes("DO_NOT_LOG"), false);
  assert.equal(run.stdout(), "");
});

test("runtime diagnostics report event-loop blocking", async () => {
  const run = launch(["--input-type=module", "-e", `
    import { startRuntimeLogging } from './dist/logging.js';
    const stop = startRuntimeLogging();
    setTimeout(() => { const end = performance.now() + 250; while (performance.now() < end) {} }, 40);
    setTimeout(stop, 500);
  `]);
  const [code] = await once(run.child, "exit");
  assert.equal(code, 0, run.stderr());
  assert.ok(run.logs.some((entry) => entry.event === "runtime.metrics" && entry.eventLoopDelayMaxMs >= 200 && entry.level === "warn"));
});
