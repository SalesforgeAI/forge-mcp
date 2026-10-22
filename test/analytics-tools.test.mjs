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

const name = "list_sent_messages";
const base = "https://multichannel-api.salesforge.ai/public/multichannel/workspaces/w%2F1/analytics/messages";
const valid = { workspaceId: "w/1", sequenceIds: [1001, 1002], fromDate: "2026-10-01", toDate: "2026-10-07" };

test("list_sent_messages repeats array params and maps filters to the analytics endpoint", async (t) => {
  const client = await setup(t);
  const calls = [];
  const response = { data: [], limit: 2, hasMore: false };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  const tool = (await client.listTools()).tools.find((tool) => tool.name === name);
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ["workspaceId", "sequenceIds", "fromDate", "toDate"]);
  assert.equal(tool.annotations?.readOnlyHint, true);

  const result = await client.callTool({ name, arguments: valid });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.content[0].text), response);
  assert.deepEqual(calls.at(-1), {
    url: `${base}?sequence_ids=1001&sequence_ids=1002&from_date=2026-10-01&to_date=2026-10-07`,
    method: "GET",
  });

  await client.callTool({
    name,
    arguments: {
      ...valid,
      timezone: "America/New_York",
      channel: "email",
      engagement: "replied",
      leadIds: ["lead_a", "lead_b"],
      messageType: "inmail",
      leadStatus: "bounce-shield",
      senderProfileId: 7,
      order: "desc",
      cursor: "abc",
      limit: 2,
    },
  });
  const url = new URL(calls.at(-1).url);
  assert.deepEqual(url.searchParams.getAll("sequence_ids"), ["1001", "1002"]);
  assert.deepEqual(url.searchParams.getAll("lead_ids"), ["lead_a", "lead_b"]);
  for (const [key, value] of Object.entries({
    from_date: "2026-10-01", to_date: "2026-10-07", timezone: "America/New_York", channel: "email",
    engagement: "replied", message_type: "inmail", lead_status: "bounce-shield", sender_profile_id: "7",
    order: "desc", cursor: "abc", limit: "2",
  })) {
    assert.equal(url.searchParams.get(key), value, key);
  }
});

test("list_sent_messages rejects invalid input before calling the API", async (t) => {
  const client = await setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));
  const invalid = [
    { ...valid, sequenceIds: [] },
    { ...valid, sequenceIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { ...valid, sequenceIds: [1, 1] },
    { ...valid, fromDate: "2026-10-08" },
    { ...valid, fromDate: "2026-09-01", toDate: "2026-10-01" },
    { ...valid, fromDate: "2026/10/01" },
    { ...valid, leadIds: [] },
    { ...valid, limit: 101 },
    { ...valid, channel: "sms" },
    { ...valid, unknownFilter: true },
  ];
  for (const args of invalid) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, JSON.stringify(args));
  }
  assert.equal(fetchMock.mock.callCount(), 0);

  // A 30-day window and a single-day window are both valid.
  const ok = [
    { ...valid, fromDate: "2026-10-01", toDate: "2026-10-30" },
    { ...valid, fromDate: "2026-10-01", toDate: "2026-10-01" },
  ];
  for (const args of ok) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
  }
});
