import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { SalesforgeClient } from "../dist/client.js";

/** Connect an MCP client to the server without network listeners. */
async function setup(t, clients = { salesforge: new SalesforgeClient("test-api-key") }) {
  const server = createServer(clients);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const core = "https://api.salesforge.ai/public/v2/workspaces/w%2F1";
const mc = "https://multichannel-api.salesforge.ai/public/multichannel/workspaces/w%2F1";
const smtp = { host: "smtp.example.com", port: 587, username: "user", password: "secret" };

test("new Salesforge tools map MCP inputs to public API contracts", async (t) => {
  const client = await setup(t);
  const calls = [];
  let response = { ok: true };
  let status = 200;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), headers: init.headers });
    return new Response(status === 204 ? null : JSON.stringify(response), { status });
  });
  const cases = [
    ["update_sender_profile", { senderProfileId: "9", updates: { linkedinAccountId: 42 } }, "PATCH", `${mc}/sender-profiles/9`, { linkedinAccountId: 42 }],
    ["delete_contact", { contactId: "c/1" }, "DELETE", `${core}/contacts/c%2F1`, undefined, 204],
    ["bulk_delete_contacts", { contactIds: ["c1", "c2"] }, "POST", `${core}/contacts/bulk-delete`, { contactIds: ["c1", "c2"] }],
    ["delete_mailbox", { mailboxId: "m/1" }, "DELETE", `${core}/mailboxes/m%2F1`, undefined, 204],
    ["update_mailbox_connection_settings", { mailboxId: "m1", smtp }, "PATCH", `${core}/mailboxes/m1/connection-settings`, { smtp }],
    ["update_mailbox_connection_settings", { mailboxId: "m1", imap: smtp }, "PATCH", `${core}/mailboxes/m1/connection-settings`, { imap: smtp }],
    ["update_mailbox_connection_settings", { mailboxId: "m1", smtp, imap: smtp }, "PATCH", `${core}/mailboxes/m1/connection-settings`, { smtp, imap: smtp }],
    ["list_tags", { limit: 20, offset: 0, search: "A & B", caseSensitive: false }, "GET", `${core}/tags?limit=20&offset=0&search=A+%26+B&caseSensitive=false`],
    ["create_sender_profile", { name: "Sender", mailboxIds: ["m1"], linkedinAccountId: 42 }, "POST", `${mc}/sender-profiles`, { name: "Sender", mailboxIds: ["m1"], linkedinAccountId: 42 }],
    ["bulk_create_sender_profiles", { profiles: [{ name: "Sender" }] }, "POST", `${mc}/sender-profiles/bulk`, { profiles: [{ name: "Sender" }] }],
    ["connect_linkedin_account", { email: "a@example.com", password: "secret", skipSenderProfile: true, proxy: { host: "socks5://proxy.example.com", port: 1080, username: "u", password: "p" } }, "POST", `${mc}/linkedin/accounts`, { email: "a@example.com", password: "secret", skipSenderProfile: true, proxy: { host: "socks5://proxy.example.com", port: 1080, username: "u", password: "p" } }],
    ["get_linkedin_account", { linkedinAccountId: 42 }, "GET", `${mc}/linkedin/accounts/42`],
    ["submit_linkedin_account_otp", { linkedinAccountId: 42, code: "012345" }, "POST", `${mc}/linkedin/accounts/42/otp`, { code: "012345" }],
    ["disconnect_linkedin_account", { linkedinAccountId: 42 }, "POST", `${mc}/linkedin/accounts/42/disconnect`],
    ["reconnect_linkedin_account", { linkedinAccountId: 42, password: "new-secret" }, "POST", `${mc}/linkedin/accounts/42/reconnect`, { password: "new-secret" }],
  ];
  const listed = (await client.listTools()).tools;
  for (const [name, args, method, url, body, responseStatus = 200] of cases) {
    assert.ok(listed.some((tool) => tool.name === name), name);
    status = responseStatus;
    const result = await client.callTool({ name, arguments: { workspaceId: "w/1", ...args } });
    assert.ok(!result.isError, JSON.stringify(result));
    assert.deepEqual(JSON.parse(result.content[0].text), status === 204 ? {} : response);
    const call = calls.at(-1);
    assert.deepEqual({ url: call.url, method: call.method, body: call.body }, { url, method, body }, name);
    assert.equal(call.headers.Authorization, "test-api-key");
    assert.equal(call.headers["X-Source"], "forge-mcp");
  }
  response = { results: [{ index: 0, senderProfile: { id: 1 } }, { index: 1, error: "Already attached" }] };
  const partial = await client.callTool({ name: "bulk_create_sender_profiles", arguments: { workspaceId: "w1", profiles: [{ name: "A" }, { name: "B" }] } });
  assert.deepEqual(JSON.parse(partial.content[0].text), response);
  status = 409;
  response = { message: "Account already connected" };
  const conflict = await client.callTool({ name: "reconnect_linkedin_account", arguments: { workspaceId: "w1", linkedinAccountId: 42, password: "secret" } });
  assert.equal(conflict.isError, true);
  assert.match(conflict.content[0].text, /409/);
  assert.ok(!listed.some(({ name }) => /^(delete_linkedin_account|disconnect_mailbox)$/.test(name)));
});

test("invalid lifecycle inputs never reach the API", async (t) => {
  const client = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const cases = [
    ["update_mailbox_connection_settings", { mailboxId: "m1" }],
    ["update_mailbox_connection_settings", { mailboxId: "m1", smtp: { ...smtp, password: "" } }],
    ["update_mailbox_connection_settings", { mailboxId: "m1", smtp: { ...smtp, port: 65536 } }],
    ["update_mailbox_connection_settings", { mailboxId: "m1", smtp: { password: "only-password" } }],
    ["bulk_delete_contacts", { contactIds: [] }],
    ["bulk_delete_contacts", { contactIds: Array(1001).fill("c") }],
    ["bulk_create_sender_profiles", { profiles: [] }],
    ["bulk_create_sender_profiles", { profiles: Array(101).fill({ name: "A" }) }],
    ["create_sender_profile", { name: "A", linkedinAccountId: 0 }],
    ["get_linkedin_account", { linkedinAccountId: 1.5 }],
    ["submit_linkedin_account_otp", { linkedinAccountId: 42, code: "123" }],
    ["reconnect_linkedin_account", { linkedinAccountId: 42 }],
    ["list_tags", { limit: 101 }],
  ];
  for (const [name, args] of cases) {
    const result = await client.callTool({ name, arguments: { workspaceId: "w1", ...args } });
    assert.equal(result.isError, true, name);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("Salesforge tools require a configured Salesforge client", async (t) => {
  const client = await setup(t, {});
  assert.equal(client.getServerCapabilities().tools, undefined);
});
