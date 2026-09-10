import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mode = process.env.TEST_MODE;
const pending = new WeakMap();
const originalConnect = McpServer.prototype.connect;
const originalServerClose = McpServer.prototype.close;
const originalTransportClose = StreamableHTTPServerTransport.prototype.close;
const originalHandle = StreamableHTTPServerTransport.prototype.handleRequest;

/** Emit lifecycle observations for integration assertions. */
function record(event) {
  process.stderr.write(JSON.stringify({ event }) + "\n");
}

/** Simulate an error after the SDK attaches its transport. */
McpServer.prototype.connect = async function (transport) {
  await originalConnect.call(this, transport);
  if (mode === "connect-error") throw new Error("Simulated connect failure");
};

/** Track server cleanup and optionally simulate a cleanup failure. */
McpServer.prototype.close = async function () {
  record("test.server.close");
  await originalServerClose.call(this);
  if (mode === "server-close-error") throw new Error("Simulated server cleanup failure");
};

/** Track transport cleanup and release a handler that is waiting for disconnect. */
StreamableHTTPServerTransport.prototype.close = async function () {
  record("test.transport.close");
  await originalTransportClose.call(this);
  pending.get(this)?.();
  if (mode === "transport-close-error") throw new Error("Simulated transport cleanup failure");
};

/** Exercise failed and stalled handlers without contacting an external service. */
StreamableHTTPServerTransport.prototype.handleRequest = async function (...args) {
  if (mode === "handle-error") throw new Error("Simulated handler failure");
  if (mode === "disconnect") {
    await new Promise((resolve) => {
      pending.set(this, resolve);
      record("test.handler.pending");
    });
    return;
  }
  return originalHandle.apply(this, args);
};

/** Supply a deterministic upstream response for an actual SDK tool call. */
globalThis.fetch = async () => new Response(JSON.stringify({ accountId: "test-account" }), {
  headers: { "Content-Type": "application/json" },
});

await import("../../dist/http.js");
