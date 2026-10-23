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

  await client.callTool({ name, arguments: { ...valid, variantId: 5, language: "german" } });
  assert.equal(calls.at(-1).url, `${base}?variantId=5&language=german`);
});

test("spam_check_sequence_node rejects an unknown language", async (t) => {
  const client = await setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));
  const result = await client.callTool({ name, arguments: { ...valid, language: "klingon" } });
  assert.equal(result.isError, true);
  assert.equal(fetchMock.mock.callCount(), 0);
});
