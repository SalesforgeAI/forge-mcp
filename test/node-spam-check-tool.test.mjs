import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { SalesforgeClient } from "../dist/client.js";

/** Connect the real MCP server to a client for tool schema and invocation tests. */
async function setup(t) {
  const server = createServer({ salesforge: new SalesforgeClient("test-api-key") });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const name = "spam_check_sequence_node";
const base = "https://multichannel-api.salesforge.ai/public/multichannel/workspaces/w%2F1/sequences/10/nodes/20/spam-check";
const valid = { workspaceId: "w/1", sequenceId: "10", nodeId: "20" };

test("spam_check_sequence_node calls the node spam-check endpoint", async (t) => {
  const client = await setup(t);
  const calls = [];
  const response = { nodeId: 20, language: "american_english", variants: [] };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const tool = (await client.listTools()).tools.find((tool) => tool.name === name);
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ["workspaceId", "sequenceId", "nodeId"]);
  assert.equal(tool.annotations?.readOnlyHint, true);

  const result = await client.callTool({ name, arguments: valid });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.content[0].text), response);
  assert.deepEqual(calls.at(-1), { url: base, method: "GET" });

  await client.callTool({ name, arguments: { ...valid, variantId: 5 } });
  let url = new URL(calls.at(-1).url);
  assert.equal(url.origin + url.pathname, base);
  assert.deepEqual([...url.searchParams], [["variantId", "5"]]);

  await client.callTool({ name, arguments: { ...valid, language: "german" } });
  url = new URL(calls.at(-1).url);
  assert.deepEqual([...url.searchParams], [["language", "german"]]);

  await client.callTool({ name, arguments: { ...valid, variantId: 5, language: "german" } });
  url = new URL(calls.at(-1).url);
  assert.equal(url.searchParams.get("variantId"), "5");
  assert.equal(url.searchParams.get("language"), "german");
});

test("spam_check_sequence_node rejects invalid input before calling the API", async (t) => {
  const client = await setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));
  assert.ok((await client.listTools()).tools.some((tool) => tool.name === name));
  const ok = await client.callTool({ name, arguments: valid });
  assert.ok(!ok.isError, JSON.stringify(ok));
  fetchMock.mock.resetCalls();
  const invalid = [
    { sequenceId: "10", nodeId: "20" },
    { workspaceId: "w/1", nodeId: "20" },
    { workspaceId: "w/1", sequenceId: "10" },
    { ...valid, variantId: 1.5 },
    { ...valid, variantId: "5" },
    { ...valid, language: "klingon" },
  ];
  for (const args of invalid) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, JSON.stringify(args));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});
