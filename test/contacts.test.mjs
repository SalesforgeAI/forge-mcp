import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { SalesforgeClient } from "../dist/client.js";
import { registerContactTools } from "../dist/tools/contacts.js";

/** Capture a registered tool while exercising the real client and URL serialization. */
function contactTool(name = "list_contacts") {
  const tools = new Map();
  registerContactTools({
    /** Record the tool schema and handler for the test. */
    registerTool(name, config, handler) { tools.set(name, { config, handler }); },
  }, new SalesforgeClient("test-key"));
  return tools.get(name);
}

test("list_contacts uses cursor mode from the first call and forwards the next cursor and filters", async (t) => {
  const requests = [];
  const responses = [
    { data: [{ id: "lead_a" }], limit: 1, hasMore: true, nextCursor: "opaque_cursor" },
    { data: [], limit: 1, hasMore: false },
  ];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url));
    return new Response(JSON.stringify(responses[requests.length - 1]), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  });
  const { config, handler } = contactTool();
  const schema = z.object(config.inputSchema);
  assert.equal(config.inputSchema.offset, undefined);
  assert.ok(config.inputSchema.cursor);
  const args = {
    workspaceId: "wks_1", limit: 1, tagIds: ["tag_a", "tag_b"],
    validationStatuses: ["safe", "unvalidated"], notInSequenceId: "seq_1",
    hasValidLinkedIn: true, notInEsps: ["google", "microsoft"],
  };
  const first = await handler(schema.parse(args));
  const firstPage = JSON.parse(first.content[0].text);
  assert.deepEqual(firstPage, responses[0]);
  const last = await handler(schema.parse({ ...args, cursor: firstPage.nextCursor }));
  assert.deepEqual(JSON.parse(last.content[0].text), responses[1]);
  for (const url of requests) {
    assert.equal(url.pathname, "/public/v2/workspaces/wks_1/contacts");
    assert.equal(url.searchParams.get("pagination"), "cursor");
    assert.equal(url.searchParams.get("limit"), "1");
    assert.equal(url.searchParams.has("offset"), false);
    assert.deepEqual(url.searchParams.getAll("tag_ids[]"), args.tagIds);
    assert.deepEqual(url.searchParams.getAll("validation_statuses[]"), args.validationStatuses);
    assert.deepEqual(url.searchParams.getAll("not_in_esps[]"), args.notInEsps);
    assert.equal(url.searchParams.get("not_in_sequence_id"), "seq_1");
    assert.equal(url.searchParams.get("has_valid_linkedin"), "true");
  }
  assert.equal(requests[0].searchParams.has("cursor"), false);
  assert.equal(requests[1].searchParams.get("cursor"), "opaque_cursor");
});

test("list_contacts validates page sizes and rejects empty continuation cursors", () => {
  const { config } = contactTool();
  const schema = z.object(config.inputSchema);
  for (const limit of [0, -1, 1.5, 1001]) {
    assert.equal(schema.safeParse({ workspaceId: "wks_1", limit }).success, false);
  }
  assert.equal(schema.safeParse({ workspaceId: "wks_1", cursor: "" }).success, false);
  assert.equal(schema.safeParse({ workspaceId: "wks_1", limit: 1000 }).success, true);
  assert.equal(schema.safeParse({ workspaceId: "wks_1" }).success, true);
});

test("count_contacts sends only shared filters and returns the exact count", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url));
    return new Response(JSON.stringify({ total: 859619 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  });
  const { config, handler } = contactTool("count_contacts");
  const schema = z.object(config.inputSchema);
  for (const key of ["limit", "offset", "cursor", "pagination"]) {
    assert.equal(config.inputSchema[key], undefined);
  }
  const args = {
    workspaceId: "wks_1", tagIds: ["tag_a", "tag_b"],
    validationStatuses: ["safe", "unvalidated"], notInSequenceId: "seq_1",
    hasValidLinkedIn: false, notInEsps: ["google", "microsoft"],
  };
  const response = await handler(schema.parse(args));
  assert.deepEqual(JSON.parse(response.content[0].text), { total: 859619 });
  assert.equal(requests.length, 1);
  const url = requests[0];
  assert.equal(url.pathname, "/public/v2/workspaces/wks_1/contacts/count");
  for (const key of ["limit", "offset", "cursor", "pagination"]) {
    assert.equal(url.searchParams.has(key), false);
  }
  assert.deepEqual(url.searchParams.getAll("tag_ids[]"), args.tagIds);
  assert.deepEqual(url.searchParams.getAll("validation_statuses[]"), args.validationStatuses);
  assert.deepEqual(url.searchParams.getAll("not_in_esps[]"), args.notInEsps);
  assert.equal(url.searchParams.get("has_valid_linkedin"), "false");
  assert.equal(url.searchParams.get("not_in_sequence_id"), "seq_1");
});

test("count_contacts preserves zero and reports upstream errors", async (t) => {
  const { handler } = contactTool("count_contacts");
  t.mock.method(globalThis, "fetch", async () => new Response('{"total":0}', { status: 200 }));
  const zero = await handler({ workspaceId: "wks_1" });
  assert.deepEqual(JSON.parse(zero.content[0].text), { total: 0 });
  t.mock.method(globalThis, "fetch", async () => new Response('count failed', { status: 500 }));
  const failed = await handler({ workspaceId: "wks_1" });
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /500/);
});
