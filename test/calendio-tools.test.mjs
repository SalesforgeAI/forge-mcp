import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { ApiClient } from "../dist/api-client.js";
import { createLeadLinks } from "../dist/tools/calendio/lead-links.js";

const base = "https://api.calendio.ai/v1";
const calendio = () => new ApiClient("Bearer test-key", base, "Calendio");

/** Connect an MCP client to a calendio-only server without network listeners. */
async function setup(t) {
  const server = createServer({ calendio: calendio() });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

const linkId = "0a6f1e36-3a4c-4b8e-9d3f-2c1b5e7a9f10";
const otherLinkId = "5d2c8b1a-7e6f-4a3b-8c9d-0e1f2a3b4c5d";
const id = "9b1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

test("every Calendio tool is registered", async (t) => {
  const client = await setup(t);
  const names = (await client.listTools()).tools
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("calendio_"))
    .sort();
  assert.deepEqual(names, [
    "calendio_connect_calendar",
    "calendio_create_lead_links",
    "calendio_create_webhook",
    "calendio_delete_lead_link",
    "calendio_delete_webhook",
    "calendio_get_busy_times",
    "calendio_get_date_overrides",
    "calendio_get_lead_link",
    "calendio_get_link_group",
    "calendio_get_webhook",
    "calendio_list_availabilities",
    "calendio_list_lead_links",
    "calendio_list_link_groups",
    "calendio_list_meeting_links",
    "calendio_list_webhooks",
    "calendio_replace_date_overrides",
    "calendio_set_meeting_link_active",
    "calendio_set_meeting_outcome",
  ]);
});

test("Calendio tools map inputs to the public API", async (t) => {
  const client = await setup(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: new URL(url), method: init.method, body: init.body && JSON.parse(init.body), headers: init.headers });
    return json({ ok: true });
  });

  const overrides = [{ date: "2026-12-24", intervals: [] }, { date: "2026-12-27", intervals: [{ start: "09:00", end: "12:00" }] }];
  const cases = [
    ["calendio_create_lead_links", { meetingLinkId: linkId, leads: [{ email: "ada@example.com", lead: { first_name: "Ada" }, externalLeadId: "sf:lead:42", context: { campaign: "Q4" } }] },
      "POST", "/lead-links", [], { meetingLinkId: linkId, email: "ada@example.com", lead: { first_name: "Ada" }, externalLeadId: "sf:lead:42", context: { campaign: "Q4" } }],
    ["calendio_list_lead_links", { page: 2, size: 50, search: "ada", meetingLinkId: [linkId, otherLinkId], meetingStatus: ["booked", "rescheduled"], meetingOutcome: ["needed"], meetingTime: "upcoming", order: "starts" },
      "GET", "/lead-links", [["page", "2"], ["size", "50"], ["search", "ada"], ["meetingLinkId", linkId], ["meetingLinkId", otherLinkId], ["meetingStatus", "booked"], ["meetingStatus", "rescheduled"], ["meetingOutcome", "needed"], ["meetingTime", "upcoming"], ["order", "starts"]]],
    ["calendio_list_lead_links", {}, "GET", "/lead-links", []],
    ["calendio_get_lead_link", { id }, "GET", `/lead-links/${id}`, []],
    ["calendio_delete_lead_link", { id }, "DELETE", `/lead-links/${id}`, []],
    ["calendio_set_meeting_outcome", { id, outcome: "no-show" }, "PUT", `/lead-links/${id}/meeting/outcome`, [], { outcome: "no-show" }],
    ["calendio_list_meeting_links", { page: 1, size: 10, groupId: id }, "GET", "/meeting-links", [["page", "1"], ["size", "10"], ["groupId", id]]],
    ["calendio_set_meeting_link_active", { id, isActive: false }, "PUT", `/meeting-links/${id}/active`, [], { isActive: false }],
    ["calendio_list_availabilities", { search: "office" }, "GET", "/availabilities", [["search", "office"]]],
    ["calendio_list_link_groups", { page: 3 }, "GET", "/meeting-link-groups", [["page", "3"]]],
    ["calendio_get_link_group", { id }, "GET", `/meeting-link-groups/${id}`, []],
    ["calendio_connect_calendar", { id, provider: "microsoft" }, "POST", `/meeting-link-groups/${id}/calendar/authorization`, [], { provider: "microsoft" }],
    ["calendio_get_busy_times", { id, from: "2026-11-02T00:00:00Z", to: "2026-11-09T00:00:00+01:00" },
      "GET", `/meeting-link-groups/${id}/calendar/busy`, [["from", "2026-11-02T00:00:00Z"], ["to", "2026-11-09T00:00:00+01:00"]]],
    ["calendio_get_date_overrides", { id }, "GET", `/meeting-link-groups/${id}/date-overrides`, []],
    ["calendio_replace_date_overrides", { id, timezone: "Europe/Warsaw", overrides }, "PUT", `/meeting-link-groups/${id}/date-overrides`, [], { timezone: "Europe/Warsaw", overrides }],
    ["calendio_list_webhooks", { size: 20 }, "GET", "/webhook-endpoints", [["size", "20"]]],
    ["calendio_create_webhook", { url: "https://example.com/hook", events: ["meeting.booked", "meeting.held"] },
      "POST", "/webhook-endpoints", [], { url: "https://example.com/hook", events: ["meeting.booked", "meeting.held"] }],
    ["calendio_get_webhook", { id }, "GET", `/webhook-endpoints/${id}`, []],
    ["calendio_delete_webhook", { id }, "DELETE", `/webhook-endpoints/${id}`, []],
  ];

  for (const [name, args, method, path, query, body] of cases) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name}: ${JSON.stringify(result)}`);
    const call = calls.at(-1);
    assert.equal(call.method, method, name);
    assert.equal(call.url.origin + call.url.pathname, base + path, name);
    assert.deepEqual([...call.url.searchParams], query, name);
    assert.equal(call.headers.Authorization, "Bearer test-key", name);
    assert.deepEqual(call.body, body, name);
  }
});

test("one failed lead does not stop the batch; results line up with leads", async (t) => {
  const client = await setup(t);
  const sent = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    sent.push(body.email);
    if (body.email === "bad") return json({ _tag: "validation-failed", message: "Invalid email" }, 400);
    return json({ id: `link-${body.email}`, url: `https://app.calendio.ai/b/${body.email}` });
  });

  const result = await client.callTool({
    name: "calendio_create_lead_links",
    arguments: { meetingLinkId: linkId, leads: [{ email: "ada@example.com" }, { email: "bad" }, { email: "bo@example.com" }] },
  });

  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(sent, ["ada@example.com", "bad", "bo@example.com"]);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    results: [
      { ok: true, leadLink: { id: "link-ada@example.com", url: "https://app.calendio.ai/b/ada@example.com" } },
      { ok: false, email: "bad", error: 'Calendio API error 400: {"_tag":"validation-failed","message":"Invalid email"}' },
      { ok: true, leadLink: { id: "link-bo@example.com", url: "https://app.calendio.ai/b/bo@example.com" } },
    ],
  });
});

test("a rate-limited lead waits retryAfterSeconds (capped at 60) and is retried once", async (t) => {
  const responses = [
    json({ _tag: "rate-limited", message: "Slow down", retryAfterSeconds: 90 }, 429),
    json({ id: "link-1", url: "https://app.calendio.ai/b/1" }),
    json({ _tag: "rate-limited", message: "Slow down", retryAfterSeconds: 2 }, 429),
    json({ _tag: "rate-limited", message: "Slow down", retryAfterSeconds: 2 }, 429),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  const waits = [];

  const result = await createLeadLinks(
    calendio(),
    linkId,
    [{ email: "ada@example.com" }, { email: "bo@example.com" }],
    async (ms) => { waits.push(ms); },
  );

  assert.deepEqual(waits, [60000, 2000]);
  assert.equal(responses.length, 0);
  assert.deepEqual(result, {
    results: [
      { ok: true, leadLink: { id: "link-1", url: "https://app.calendio.ai/b/1" } },
      { ok: false, email: "bo@example.com", error: 'Calendio API error 429: {"_tag":"rate-limited","message":"Slow down","retryAfterSeconds":2}' },
    ],
  });
});

test("strict schemas reject unknown keys and out-of-range page sizes", async (t) => {
  const client = await setup(t);
  const cases = [
    ["calendio_create_lead_links", { meetingLinkId: linkId, leads: [{ email: "a@b.co", lead: { firstName: "Ada" } }] }, /unrecognized_keys[\s\S]*firstName/],
    ["calendio_list_lead_links", { workspaceId: id }, /unrecognized_keys[\s\S]*workspaceId/],
    ["calendio_list_lead_links", { size: 5 }, /too_small/],
    ["calendio_list_webhooks", { size: 51 }, /too_big/],
    ["calendio_get_lead_link", { id: "not-a-uuid" }, /uuid/],
  ];
  for (const [name, args, reason] of cases) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, `${name} should reject ${JSON.stringify(args)}`);
    assert.match(result.content[0].text, reason, name);
  }
});
