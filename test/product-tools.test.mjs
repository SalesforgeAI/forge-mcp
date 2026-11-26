import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { SalesforgeClient } from "../dist/client.js";

async function setup(t) {
  const server = createServer({ salesforge: new SalesforgeClient("test-api-key") });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const products = "https://api.salesforge.ai/public/v2/workspaces/w%2F1/products";
const card = {
  name: "Salesforge",
  internalName: "Salesforge SMB",
  industry: "Sales technology",
  idealCustomerProfile: "Sales teams",
  pain: "Teams waste hours on manual outreach",
  solution: "Automated multichannel sequences",
  costOfInaction: "Missed pipeline every quarter",
  proofPoints: "Used by 10,000 teams",
  language: "american_english",
};
const german = {
  language: "german",
  name: "Salesforge DE",
  pain: "Teams verschwenden Stunden",
  solution: "Automatisierte Sequenzen",
  costOfInaction: "Verpasste Pipeline",
  proofPoints: "Von 10.000 Teams genutzt",
};

test("SF-11385 product tools call the public product endpoints", async (t) => {
  const client = await setup(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), headers: init.headers });
    return new Response(init.method === "DELETE" ? null : JSON.stringify({ id: "prd_1" }), {
      status: init.method === "DELETE" ? 204 : 200,
    });
  });
  const cases = [
    ["list_products", { limit: 20, offset: 40 }, "GET", `${products}?limit=20&offset=40`],
    ["get_product", { productId: "p/1" }, "GET", `${products}/p%2F1`],
    ["create_product", { product: card, translation: [german] }, "POST", products, {
      product: card,
      translation: [{ industry: card.industry, idealCustomerProfile: card.idealCustomerProfile, ...german }],
    }],
    ["update_product", { productId: "p/1", product: { pain: "New pain" }, translation: [{ language: "german", pain: "Neu" }] },
      "PATCH", `${products}/p%2F1`, { product: { pain: "New pain" }, translation: [{ language: "german", pain: "Neu" }] }],
    ["delete_product", { productId: "p/1" }, "DELETE", `${products}/p%2F1`],
    ["delete_product_translation", { productId: "p/1", translationId: "pt/1" }, "DELETE", `${products}/p%2F1/translations/pt%2F1`],
  ];

  for (const [name, args, method, url, body] of cases) {
    const result = await client.callTool({ name, arguments: { workspaceId: "w/1", ...args } });
    assert.ok(!result.isError, `${name}: ${JSON.stringify(result)}`);
    const call = calls.at(-1);
    assert.deepEqual({ url: call.url, method: call.method, body: call.body }, { url, method, body }, name);
    assert.equal(call.headers["X-Source"], "forge-mcp", name);
  }
});

test("invalid product inputs never reach the API", async (t) => {
  const client = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const cases = [
    ["create_product", { product: { ...card, pain: "x".repeat(301) } }],
    ["create_product", { product: { ...card, language: "english" } }],
    ["create_product", { product: { ...card, pain: undefined } }],
    ["update_product", { productId: "p1", product: { solution: "x".repeat(301) } }],
    ["update_product", { productId: "p1", translation: [{ pain: "Neu" }] }],
    ["delete_product_translation", { productId: "p1" }],
    ["list_products", { limit: 101 }],
  ];

  for (const [name, args] of cases) {
    const result = await client.callTool({ name, arguments: { workspaceId: "w1", ...args } });
    assert.equal(result.isError, true, name);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
