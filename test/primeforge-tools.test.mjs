import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { ApiClient } from "../dist/api-client.js";

/** Connect an MCP client to a primeforge-only server without network listeners. */
async function setup(t) {
  const server = createServer({
    primeforge: new ApiClient("test-api-key", "https://api.primeforge.ai/public", "PrimeForge"),
  });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const name = "primeforge_set_domain_forwarding";
const url = "https://api.primeforge.ai/public/workspaces/ws_1/domains/forwarding";

test("primeforge_set_domain_forwarding sends domainIds and forwardingUrl to the workspace forwarding endpoint", async (t) => {
  const client = await setup(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
    return new Response("null", { status: 200 });
  });

  const result = await client.callTool({
    name,
    arguments: { workspaceId: "ws_1", domainIds: ["dom_1", "dom_2"], forwardingUrl: "https://example.com" },
  });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(calls.at(-1), {
    url,
    method: "POST",
    body: { domainIds: ["dom_1", "dom_2"], forwardingUrl: "https://example.com" },
  });

  const withoutUrl = await client.callTool({ name, arguments: { workspaceId: "ws_1", domainIds: ["dom_1"] } });
  assert.ok(!withoutUrl.isError, JSON.stringify(withoutUrl));
  assert.deepEqual(calls.at(-1), { url, method: "POST", body: { domainIds: ["dom_1"] } });
});

test("primeforge_set_domain_forwarding rejects invalid input before calling the API", async (t) => {
  const client = await setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 200 }));
  const invalid = [
    { workspaceId: "ws_1", forwardToDomain: "example.com" },
    { workspaceId: "ws_1", domainIds: [] },
    { workspaceId: "ws_1", domainIds: [""] },
    { workspaceId: "ws_1", domainIds: ["dom_1"], forwardingUrl: "example.com" },
    { domainIds: ["dom_1"] },
  ];
  for (const args of invalid) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, JSON.stringify(args));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});
