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

const base = "https://multichannel-api.salesforge.ai/public/multichannel/workspaces/w%2F1/sequences/42/leads";

test("sequence lead listing maps all filters and execution timelines to the public endpoint", async (t) => {
  const client = await setup(t);
  const calls = [];
  const response = {
    leads: [{
      lead: {
        leadId: "lead/1", firstName: "Ada", lastName: "Lovelace",
        email: "ada@example.com", linkedinUrl: "https://www.linkedin.com/in/ada",
      },
      enrollment: { status: "completed", updatedAt: "2026-09-16T12:00:00Z", inSubsequence: true },
      timeline: [{
        nodeId: 7, nodeType: "action", actionName: "send_email", actionChannel: "email",
        executionOrder: 1, executionStatus: "completed", executedAt: "2026-09-15T12:00:00Z",
        delivery: { channel: "email", status: "sent", sentAt: "2026-09-15T12:00:00Z" },
        engagement: { openCount: 0, clickCount: 0 },
        content: { message: "Hello", contentType: "text/plain" },
        sender: {
          senderProfileId: 1, senderProfileName: "Email outreach", mailboxId: "mailbox-1",
          email: "sender@example.com", linkedinUrl: "",
        },
      }, {
        nodeId: 8, nodeType: "action", actionName: "li_send_message", actionChannel: "linkedin",
        executionOrder: 2, executionStatus: "completed", executedAt: "2026-09-16T11:00:00Z",
        delivery: { channel: "linkedin", status: "sent" },
        replyContent: {
          channel: "linkedin", message: "Thanks!", contentType: "text/plain", repliedAt: "2026-09-16T12:00:00Z",
        },
        sender: {
          senderProfileId: 2, senderProfileName: "LinkedIn outreach",
          email: "", linkedinUrl: "https://www.linkedin.com/in/sender",
        },
      }],
    }],
    pagination: { page: 2, limit: 10, total: 11, totalPages: 2, hasNext: false },
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: new URL(url), ...init });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const listed = (await client.listTools()).tools;
  const tool = listed.find((tool) => tool.name === "list_sequence_leads");
  assert.ok(tool);
  assert.equal(tool.annotations.readOnlyHint, true);
  const result = await client.callTool({ name: "list_sequence_leads", arguments: {
    workspaceId: "w/1", sequenceId: "42", page: 2, limit: 10, status: "completed", q: "Ada & Grace",
    openedEmailsOnly: false, inSubsequence: true, leadIds: ["lead/1", "lead-2"],
    sortBy: "recently_added", sortOrder: "asc", from: "2026-09-01", to: "2026-09-16",
  } });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.content[0].text), response);
  assert.equal(calls[0].url.origin + calls[0].url.pathname, base);
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), {
    page: "2", limit: "10", status: "completed", q: "Ada & Grace", openedEmailsOnly: "false", in_subsequence: "true",
    leadIds: "lead/1,lead-2", sortBy: "recently_added", sortOrder: "asc", from: "2026-09-01", to: "2026-09-16",
  });
  const minimal = await client.callTool({ name: "list_sequence_leads", arguments: { workspaceId: "w/1", sequenceId: "42" } });
  assert.ok(!minimal.isError);
  assert.equal(calls[1].url.href, `${base}?sortBy=recently_updated`);
  const progress = await client.callTool({ name: "list_sequence_leads", arguments: { workspaceId: "w/1", sequenceId: "42", leadIds: ["lead/1?#"] } });
  assert.ok(!progress.isError);
  assert.equal(calls[2].url.origin + calls[2].url.pathname, base);
  assert.equal(calls[2].url.searchParams.get("leadIds"), "lead/1?#");
  assert.deepEqual(JSON.parse(progress.content[0].text), response);
  const filtered = await client.callTool({ name: "list_sequence_leads", arguments: { workspaceId: "w/1", sequenceId: "42", status: "bounce-shield" } });
  assert.ok(!filtered.isError);
  assert.equal(calls[3].url.searchParams.get("status"), "bounce-shield");
  for (const call of calls) {
    assert.equal(call.method, "GET");
    assert.equal(call.body, undefined);
    assert.equal(call.headers.Authorization, "test-api-key");
    assert.equal(call.headers["X-Source"], "forge-mcp");
  }
});

test("invalid lead progress inputs never reach the API", async (t) => {
  const client = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  for (const args of [
    { page: 0 }, { page: 1.5 }, { limit: 0 }, { limit: 101 }, { limit: 1.5 },
    { sequenceId: "seq_123" }, { sequenceId: "0" }, { sequenceId: "2147483648" }, { sequenceId: "1/2" },
    { workspaceId: "" }, { sortBy: "unknown" }, { sortOrder: "unknown" }, { openedEmailsOnly: "true" },
    { leadIds: [] }, { leadIds: [""] }, { leadIds: ["lead-1,lead-2"] },
    { from: "2026-09-01" }, { to: "2026-09-01" },
    { from: "2026-02-30", to: "2026-09-01" }, { from: "2026-09-16", to: "2026-09-01" },
  ]) {
    const result = await client.callTool({ name: "list_sequence_leads", arguments: { workspaceId: "w1", sequenceId: "42", ...args } });
    assert.equal(result.isError, true, JSON.stringify(args));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("sequence lead tools return API failures as MCP errors", async (t) => {
  const client = await setup(t);
  let status = 404;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Lead unavailable" }), { status }));
  for (const name of ["list_sequence_leads"]) {
    for (status of [403, 404]) {
      const result = await client.callTool({ name, arguments: { workspaceId: "w1", sequenceId: "42", leadIds: ["lead-1"] } });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, new RegExp(String(status)));
      assert.match(result.content[0].text, /Lead unavailable/);
    }
  }
});
