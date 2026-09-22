import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/** Wait for a lifecycle event with a bounded deadline. */
async function waitFor(logs, event, count = 1) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const matches = logs.filter((entry) => entry.event === event);
    if (matches.length >= count) return matches.at(-1);
    await delay(20);
  }
  assert.fail(`Missing ${event}: ${JSON.stringify(logs)}`);
}

/** Run the HTTP entry point with instrumented SDK cleanup and register teardown. */
async function startServer(t, mode = "") {
  const logs = [];
  let pending = "";
  const child = spawn(process.execPath, ["test/fixtures/http-server.mjs"], {
    env: { ...process.env, PORT: "0", LOG_LEVEL: "debug", TEST_MODE: mode },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop();
    for (const line of lines) {
      try { logs.push(JSON.parse(line)); } catch { /* Native diagnostics are not lifecycle events. */ }
    }
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  });
  const listening = await waitFor(logs, "http.server.listening");
  return { logs, url: new URL(`http://127.0.0.1:${listening.port}/mcp`) };
}

const headers = {
  "X-Salesforge-Key": "test-key", "Content-Type": "application/json", Accept: "application/json, text/event-stream",
};

test("GET/HEAD reject SSE before server creation; OPTIONS and SDK POST operations work", { timeout: 15000 }, async (t) => {
  const { logs, url } = await startServer(t);
  for (const method of ["GET", "HEAD"]) {
    for (const requestHeaders of [{}, headers]) {
      const response = await fetch(url, { method, headers: requestHeaders });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "POST, DELETE, OPTIONS");
      assert.equal(await response.text(), "");
    }
  }
  const options = await fetch(url, { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-methods"), "POST, DELETE, OPTIONS");
  assert.equal(logs.filter((entry) => entry.event === "mcp.server.created").length, 0);

  const client = new Client({ name: "lifecycle-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "get_me"));
  const result = await client.callTool({ name: "get_me", arguments: {} });
  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), { accountId: "test-account" });
  // Initialization, initialized notification, tool listing, and tool call each own resources.
  await waitFor(logs, "test.server.close", 4);
  assert.equal(logs.filter((entry) => entry.event === "test.transport.close").length, 4);
  assert.equal(logs.filter((entry) => entry.event === "test.server.close").length, 4);
  assert.equal(logs.filter((entry) => entry.event === "mcp.cleanup.failed").length, 0);
});

for (const mode of ["connect-error", "handle-error", "transport-close-error", "server-close-error"]) {
  test(`resources are cleaned up for ${mode}`, { timeout: 10000 }, async (t) => {
    const { logs, url } = await startServer(t, mode);
    const response = await fetch(url, {
      method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    assert.equal(response.status, mode.endsWith("close-error") ? 200 : 500);
    await response.text();
    await waitFor(logs, "test.server.close");
    if (mode.endsWith("close-error")) await waitFor(logs, "mcp.cleanup.failed");
    assert.equal(logs.filter((entry) => entry.event === "test.transport.close").length, 1);
    assert.equal(logs.filter((entry) => entry.event === "test.server.close").length, 1);
  });
}

test("disconnect closes resources while handling is pending, without double cleanup", { timeout: 10000 }, async (t) => {
  const { logs, url } = await startServer(t, "disconnect");
  const request = http.request(url, { method: "POST", headers });
  request.on("error", () => {});
  t.after(() => request.destroy());
  request.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }));
  await waitFor(logs, "test.handler.pending");
  request.destroy();
  await waitFor(logs, "test.server.close");
  await waitFor(logs, "mcp.request.completed");
  assert.equal(logs.filter((entry) => entry.event === "test.transport.close").length, 1);
  assert.equal(logs.filter((entry) => entry.event === "test.server.close").length, 1);
});
