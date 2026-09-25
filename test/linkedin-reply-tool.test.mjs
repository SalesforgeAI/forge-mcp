import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { SalesforgeClient } from "../dist/client.js";

/** Connect an MCP client to the Salesforge server without network listeners. */
async function setup(t) {
  const server = createServer({ salesforge: new SalesforgeClient("test-api-key") });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const name = "reply_to_linkedin_thread";
const args = { workspaceId: "w/1", threadId: "t/1 ?#", accountId: 42, message: " Hello!\nThanks for replying. " };
const attachment = { filename: "deck.pdf", contentBase64: "SGVsbG8=", contentType: "application/pdf" };

test("SF-10544 LinkedIn replies use the public thread endpoint and return the created message", async (t) => {
  const client = await setup(t);
  const calls = [];
  const response = { id: "77", accountId: 42, message: args.message, direction: "outbound" };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, method: init.method, body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const tool = (await client.listTools()).tools.find((tool) => tool.name === name);
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ["workspaceId", "threadId", "accountId", "message"]);
  const cases = [
    { accountId: 42, message: args.message },
    { accountId: 42, message: args.message, attachments: [attachment] },
    { accountId: 42, message: "", attachments: [attachment] },
    { accountId: 42, message: "", attachments: [{ filename: "deck.pdf", contentBase64: "SGVsbG8=" }] },
  ];
  for (const body of cases) {
    const result = await client.callTool({ name, arguments: { ...args, ...body } });
    assert.ok(!result.isError, JSON.stringify(result));
    assert.deepEqual(JSON.parse(result.content[0].text), response);
    assert.deepEqual(calls.at(-1), {
      url: "https://api.salesforge.ai/public/v2/workspaces/w%2F1/threads/t%2F1%20%3F%23/linkedin/reply",
      method: "POST",
      body,
      headers: {
        Authorization: "test-api-key",
        Accept: "application/json",
        "X-Source": "forge-mcp",
        "Content-Type": "application/json",
      },
    });
  }
  assert.equal(calls.length, cases.length);
});

test("invalid LinkedIn replies never reach the API", async (t) => {
  const client = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const invalid = [
    { workspaceId: "" },
    { threadId: "" },
    { accountId: undefined },
    { accountId: 0 },
    { accountId: -1 },
    { accountId: 1.5 },
    { accountId: "42" },
    { message: undefined },
    { message: "" },
    { message: " \n", attachments: [] },
    { attachments: [{ ...attachment, filename: "" }] },
    { attachments: [{ ...attachment, contentBase64: "" }] },
  ];
  for (const overrides of invalid) {
    const result = await client.callTool({ name, arguments: { ...args, ...overrides } });
    assert.equal(result.isError, true, JSON.stringify(overrides));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("LinkedIn reply API errors are surfaced as MCP tool errors", async (t) => {
  const client = await setup(t);
  let status;
  let message;
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ message }), { status }));
  const errors = [[400, "Invalid LinkedIn account"], [404, "thread not found"], [500, "Internal Server Error"]];
  for ([status, message] of errors) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes(`Salesforge API error ${status}`));
    assert.ok(result.content[0].text.includes(message));
  }
  assert.equal(fetch.mock.callCount(), errors.length);
});
