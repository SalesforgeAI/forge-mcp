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

const args = { workspaceId: "w/1", threadId: "t/1 ?#", messageId: "m/1" };
const base = "https://api.salesforge.ai/public/v2/workspaces/w%2F1/threads/t%2F1%20%3F%23/linkedin/messages/m%2F1/attachments";

test("LinkedIn attachment tools download files from the public thread endpoints", async (t) => {
  const client = await setup(t);
  const calls = [];
  let contentType;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers });
    return new Response("Hello", { status: 200, headers: { "Content-Type": contentType } });
  });
  const cases = [
    ["download_linkedin_attachments", {}, base, "application/zip"],
    ["download_linkedin_attachment", { attachmentId: "a/1" }, `${base}/a%2F1`, "application/pdf"],
  ];
  const listed = (await client.listTools()).tools;
  for (const [name, extra, url, type] of cases) {
    assert.ok(listed.some((tool) => tool.name === name), name);
    contentType = type;
    const result = await client.callTool({ name, arguments: { ...args, ...extra } });
    assert.ok(!result.isError, JSON.stringify(result));
    assert.deepEqual(JSON.parse(result.content[0].text), { contentType: type, data: "SGVsbG8=" });
    assert.deepEqual(calls.at(-1), {
      url,
      method: "GET",
      headers: { Authorization: "test-api-key", "X-Source": "forge-mcp" },
    });
  }
});

test("a LinkedIn message without attachments returns a clear message", async (t) => {
  const client = await setup(t);
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  const result = await client.callTool({ name: "download_linkedin_attachments", arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.content[0].text), { message: "This LinkedIn message has no attachments" });
});

test("invalid LinkedIn attachment inputs never reach the API", async (t) => {
  const client = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const invalid = [
    ["download_linkedin_attachments", { workspaceId: "" }],
    ["download_linkedin_attachments", { threadId: "" }],
    ["download_linkedin_attachments", { messageId: "" }],
    ["download_linkedin_attachment", {}],
    ["download_linkedin_attachment", { attachmentId: "" }],
  ];
  for (const [name, overrides] of invalid) {
    const result = await client.callTool({ name, arguments: { ...args, ...overrides } });
    assert.equal(result.isError, true, `${name} ${JSON.stringify(overrides)}`);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("LinkedIn attachment API errors are surfaced as MCP tool errors", async (t) => {
  const client = await setup(t);
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ message: "LinkedIn attachment not found" }), { status: 404 }));
  const result = await client.callTool({ name: "download_linkedin_attachment", arguments: { ...args, attachmentId: "a1" } });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes("Salesforge API error 404"));
  assert.ok(result.content[0].text.includes("LinkedIn attachment not found"));
});
