import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { SalesforgeApiError, SalesforgeClient, parseRetryAfter } from "../dist/client.js";

/** A 429 as the Salesforge public API sends it, with an optional Retry-After in seconds. */
function limited(retryAfter) {
  const headers = retryAfter === undefined ? {} : { "Retry-After": retryAfter };
  return new Response('{"message":"rate limit exceeded"}', { status: 429, headers });
}

test("a rate-limited request is sent again, body and all, until it succeeds", async (t) => {
  const bodies = [];
  const responses = [limited("0"), limited("0"), new Response('{"id":"wh_1"}', { status: 200 })];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    bodies.push(init.body);
    return responses.shift();
  });

  const result = await new SalesforgeClient("test-api-key").corePost("/workspaces/w1/integrations/webhooks", { name: "Hook" });

  assert.deepEqual(result, { id: "wh_1" });
  assert.deepEqual(bodies, Array(3).fill(JSON.stringify({ name: "Hook" })));
});

test("after three retries the 429 tells the assistant to wait", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => limited("0"));

  await assert.rejects(new SalesforgeClient("test-api-key").mcGet("/multichannel/workspaces/w1/sequences"), (error) => {
    assert.ok(error instanceof SalesforgeApiError);
    assert.equal(error.statusCode, 429);
    assert.match(error.message, /hit its Salesforge API rate limit\. Wait 1 second before trying again/);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 4);
});

test("without Retry-After the client backs off before retrying", async (t) => {
  const responses = [limited(undefined), new Response('{"total":3}', { status: 200 })];
  t.mock.method(globalThis, "fetch", async () => responses.shift());

  const started = Date.now();
  const result = await new SalesforgeClient("test-api-key").coreGet("/workspaces/w1/contacts/count");

  assert.deepEqual(result, { total: 3 });
  assert.ok(Date.now() - started >= 900, "waited about a second");
});

test("Retry-After is read as seconds or an HTTP date", () => {
  const now = Date.parse("2026-11-17T10:00:00Z");
  assert.equal(parseRetryAfter("3", now), 3000);
  assert.equal(parseRetryAfter(" 0 ", now), 0);
  assert.equal(parseRetryAfter(new Date(now + 5000).toUTCString(), now), 5000);
  assert.equal(parseRetryAfter(new Date(now - 60000).toUTCString(), now), 0);
  assert.equal(parseRetryAfter(null, now), undefined);
  assert.equal(parseRetryAfter("soon", now), undefined);
  assert.equal(parseRetryAfter("-1", now), undefined);
});

test("a wait longer than the cap is not spent in the client: the tool returns the wait advice", async (t) => {
  const server = createServer({ salesforge: new SalesforgeClient("test-api-key") });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => limited("30"));

  const result = await client.callTool({ name: "list_tags", arguments: { workspaceId: "w1" } });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /^Error: Salesforge API error 429: this account hit its Salesforge API rate limit\. Wait 30 seconds/);
  assert.equal(fetchMock.mock.callCount(), 1);
});
