import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { createHttpApp } from "../src/app.js";
import { createResourceServer } from "../src/oauth/resource-server.js";

const SECRET = "resource-server-secret";

interface Issuer {
  url: string;
  sign(claims?: Record<string, unknown>, audience?: string): Promise<string>;
  /** Grants the issuer still honours, by grant id, with their keys. */
  grants: Map<string, Record<string, { key: string; keyId: string }>>;
  rejected: Array<{ product: string; keyId: string }>;
  credentialCalls: number;
}

/** A stand-in for auth-api: its JWKS and the two internal routes a resource server calls. */
async function startIssuer(t: TestContext): Promise<Issuer> {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk: JWK = { ...await exportJWK(publicKey), kid: "k1", alg: "ES256", use: "sig" };
  const app = express();
  app.use(express.json());
  let url = "";
  const issuer: Issuer = {
    get url() { return url; },
    grants: new Map(),
    rejected: [],
    credentialCalls: 0,
    async sign(claims = {}, audience) {
      return new SignJWT({ client_id: "c", scope: "full_access", account_id: "a1", grant_id: "grt_1", ...claims })
        .setProtectedHeader({ alg: "ES256", typ: "at+jwt", kid: "k1" })
        .setIssuer(url).setSubject("u1").setAudience(audience ?? resourceUrl).setIssuedAt().setExpirationTime("1h")
        .sign(privateKey);
    },
  };

  app.get("/.well-known/jwks.json", (_req, res) => { res.json({ keys: [jwk] }); });
  app.post("/internal/oauth/credentials", (req, res) => {
    issuer.credentialCalls++;
    if (req.headers.authorization !== `Bearer ${SECRET}`) return void res.status(401).json({ error: "unauthorized" });
    const grantId = JSON.parse(Buffer.from(String(req.body.token).split(".")[1], "base64url").toString()).grant_id;
    const credentials = issuer.grants.get(grantId);
    if (!credentials) return void res.status(401).json({ error: "invalid_token" });
    res.json({ grantId, userId: "u1", accountId: "a1", credentials });
  });
  app.post("/internal/oauth/credentials/rejected", (req, res) => {
    issuer.rejected.push({ product: req.body.product, keyId: req.body.keyId });
    res.status(204).end();
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return issuer;
}

const resourceUrl = "http://localhost:3000/mcp";

async function start(t: TestContext, { oauthOn = true } = {}) {
  const issuer = await startIssuer(t);
  const oauth = oauthOn ? createResourceServer({
    issuer: issuer.url, resource: resourceUrl, jwksUrl: `${issuer.url}/.well-known/jwks.json`,
    credentialsUrl: issuer.url, credentialsSecret: SECRET, scopes: ["full_access"],
  }) : undefined;
  const server = createHttpApp(oauth).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, issuer };
}

async function withClient<T>(base: string, headers: Record<string, string>, use: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers } }));
  try {
    return await use(client);
  } finally {
    await client.close();
  }
}

const listTools = (base: string, headers: Record<string, string>) =>
  withClient(base, headers, async (client) => (await client.listTools()).tools.map((tool) => tool.name));

const post = (base: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });

test("unauthenticated /mcp gets a challenge pointing at metadata that names the issuer", async (t) => {
  const { base, issuer } = await start(t);
  const response = await post(base);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"),
    'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp", scope="full_access"');

  for (const path of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
    const metadata = await fetch(`${base}${path}`);
    assert.equal(metadata.headers.get("access-control-allow-origin"), "*");
    const body = await metadata.json() as Record<string, unknown>;
    assert.equal(body.resource, resourceUrl);
    assert.deepEqual(body.authorization_servers, [issuer.url]);
    assert.deepEqual(body.scopes_supported, ["full_access"]);
  }
  assert.equal((await fetch(`${base}/.well-known/oauth-authorization-server`)).status, 404,
    "this server is not an authorization server");
});

test("without OAuth the server keeps today's 401 and serves no metadata", async (t) => {
  const { base } = await start(t, { oauthOn: false });
  const response = await post(base);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), null);
  assert.equal((await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).status, 404);
});

test("a token opens /mcp with only its grant's products; header keys still win", async (t) => {
  const { base, issuer } = await start(t);
  issuer.grants.set("grt_1", { salesforge: { key: "sf-key", keyId: "k-sf" }, mailforge: { key: "mf-key", keyId: "k-mf" } });
  const token = await issuer.sign();

  const tools = await listTools(base, { Authorization: `Bearer ${token}` });
  assert.ok(tools.includes("get_me"));
  assert.ok(tools.includes("mailforge_list_workspaces"));
  assert.ok(!tools.some((name) => name.startsWith("primeforge_")));
  assert.equal(issuer.credentialCalls, 1, "credentials are cached per token across requests");

  const headerTools = await listTools(base, { "X-Primeforge-Key": "pf-key", Authorization: `Bearer ${token}` });
  assert.ok(headerTools.some((name) => name.startsWith("primeforge_")));
  assert.ok(!headerTools.includes("mailforge_list_workspaces"), "header keys take precedence over a bearer token");
});

test("tokens for another audience, from another issuer key, or for an ended grant get invalid_token", async (t) => {
  const { base, issuer } = await start(t);
  issuer.grants.set("grt_1", { salesforge: { key: "sf-key", keyId: "k-sf" } });

  const cases = [
    await issuer.sign({}, "https://other.example.com/mcp"),
    (await issuer.sign()).slice(0, -4) + "AAAA",
    "not-a-jwt",
    await issuer.sign({ grant_id: "grt_gone" }),
  ];
  for (const token of cases) {
    const response = await post(base, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate")!, /^Bearer error="invalid_token", resource_metadata=/);
  }
});

test("a product's 401 is reported to the issuer and the token's credentials are fetched again", async (t) => {
  const { base, issuer } = await start(t);
  issuer.grants.set("grt_1", { mailforge: { key: "mf-key", keyId: "k-mf" } });
  const token = await issuer.sign();

  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => new URL(input instanceof Request ? input.url : input).host === "api.mailforge.ai"
    ? Promise.resolve(new Response("unauthorized", { status: 401 }))
    : realFetch(input, init);
  t.after(() => { globalThis.fetch = realFetch; });

  const result = await withClient(base, { Authorization: `Bearer ${token}` },
    (client) => client.callTool({ name: "mailforge_list_workspaces", arguments: {} }));
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /no longer accepts this connection's API key/);

  for (let attempt = 0; attempt < 50 && issuer.rejected.length === 0; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.deepEqual(issuer.rejected, [{ product: "mailforge", keyId: "k-mf" }]);

  const calls = issuer.credentialCalls;
  await listTools(base, { Authorization: `Bearer ${token}` });
  assert.equal(issuer.credentialCalls, calls + 1, "a rejected key drops the cached credentials");
});
