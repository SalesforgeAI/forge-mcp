import { createHash } from "node:crypto";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { errorFields, log, loggedFetch } from "../logging.js";
import { PRODUCTS, type Product } from "../products.js";

/**
 * This server as an OAuth protected resource (RFC 9728). auth.salesforge.ai is the authorization server: it signs
 * clients in, asks for consent and issues access tokens for this server's /mcp URL. Each request's token is checked
 * here against the issuer's keys, and the grant's product API keys come from the issuer's credentials route; the
 * token itself is never sent to the products.
 */
export interface ResourceServerConfig {
  /** The authorization server, e.g. https://auth.salesforge.ai. */
  issuer: string;
  /** This server's /mcp URL, the audience its tokens must carry. */
  resource: string;
  jwksUrl: string;
  /** The issuer's internal base URL for the credentials routes. */
  credentialsUrl: string;
  credentialsSecret: string;
  scopes: string[];
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required when OAUTH_ENABLED=true`);
  return value;
}

export function oauthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OAUTH_ENABLED === "true" || env.OAUTH_ENABLED === "1";
}

export function loadResourceServerConfig(env: NodeJS.ProcessEnv = process.env): ResourceServerConfig {
  const issuer = new URL(required(env, "OAUTH_ISSUER")).origin;
  const publicBase = new URL(required(env, "PUBLIC_BASE_URL")).origin;
  return {
    issuer,
    resource: `${publicBase}/mcp`,
    jwksUrl: env.OAUTH_JWKS_URL?.trim() || `${issuer}/.well-known/jwks.json`,
    credentialsUrl: required(env, "OAUTH_CREDENTIALS_URL").replace(/\/+$/, ""),
    credentialsSecret: required(env, "OAUTH_CREDENTIALS_SECRET"),
    scopes: (env.OAUTH_SCOPES ?? "full_access").split(/[\s,]+/).filter(Boolean),
  };
}

/** A token that is malformed, expired, for another resource, or whose grant has ended. */
export class InvalidTokenError extends Error {
  constructor(message = "invalid or expired access token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export interface Credential {
  key: string;
  keyId: string;
}

export type Credentials = Partial<Record<Product, Credential>>;

export interface ResourceServer {
  /** The protected resource metadata. Mount at the root. */
  router: express.Router;
  /** The product keys an access token may use; throws InvalidTokenError when it may use none. */
  resolveBearer(token: string): Promise<Credentials>;
  /** Reports that a product answered 401 to one of a token's keys, so the issuer stops handing it out. */
  reportRejected(token: string, product: Product, credential: Credential): Promise<void>;
  /** The WWW-Authenticate value for a 401 on /mcp. */
  challenge(error?: "invalid_token"): string;
}

/** One cache entry per access token: the issuer is asked at most once a minute per token. */
const CREDENTIALS_CACHE_MS = 60_000;
const CREDENTIALS_CACHE_MAX = 10_000;
/** Well inside a client's request timeout even when the issuer is slow. */
const CREDENTIALS_TIMEOUT_MS = 5000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function createResourceServer(config: ResourceServerConfig): ResourceServer {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  // Entries go in with a lifetime of at most a minute, so the oldest are at the front and expire first.
  const cache = new Map<string, { expiresAt: number; value: Credentials }>();
  const pending = new Map<string, Promise<Credentials>>();

  const metadataPath = `/.well-known/oauth-protected-resource${new URL(config.resource).pathname}`;
  const metadataUrl = `${new URL(config.resource).origin}${metadataPath}`;
  const metadata = {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: config.scopes,
    bearer_methods_supported: ["header"],
    resource_name: "Salesforge",
  };

  const router = express.Router();
  router.get([metadataPath, "/.well-known/oauth-protected-resource"], (_req, res) => {
    // Browser-based clients read it cross-origin before they have any credentials.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(metadata);
  });

  function callIssuer<T>(path: string, body: Record<string, string>, consume: (response: Response) => Promise<T>): Promise<T> {
    return loggedFetch("auth-api", `${config.credentialsUrl}/internal/oauth/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.credentialsSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CREDENTIALS_TIMEOUT_MS),
    }, consume);
  }

  async function load(token: string, cacheKey: string): Promise<Credentials> {
    let expiresAt: number;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer, audience: config.resource, algorithms: ["ES256"], typ: "at+jwt",
        requiredClaims: ["exp", "sub"],
      });
      if (typeof payload.grant_id !== "string") throw new InvalidTokenError();
      expiresAt = payload.exp! * 1000;
    } catch {
      throw new InvalidTokenError();
    }

    // A 401 means the token's grant has ended; it answers undefined rather than failing the request log.
    const body = await callIssuer("credentials", { token }, async (response) => {
      if (response.status === 401) {
        void response.body?.cancel().catch(() => undefined);
        return undefined;
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error(`credentials request failed with status ${response.status}`);
      }
      return await response.json() as { credentials?: Record<string, Credential> };
    });
    if (!body) throw new InvalidTokenError();

    const credentials: Credentials = {};
    for (const product of PRODUCTS) {
      const credential = body.credentials?.[product];
      if (credential?.key && credential.keyId) credentials[product] = { key: credential.key, keyId: credential.keyId };
    }

    const clock = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt > clock) break;
      cache.delete(key);
    }
    if (cache.size >= CREDENTIALS_CACHE_MAX) cache.delete(cache.keys().next().value!);
    // Never cache past the token's own expiry; re-inserting keeps the map in insertion order.
    cache.delete(cacheKey);
    cache.set(cacheKey, { expiresAt: Math.min(clock + CREDENTIALS_CACHE_MS, expiresAt), value: credentials });
    return credentials;
  }

  return {
    router,
    resolveBearer(token) {
      const cacheKey = sha256(token);
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
      // Parallel calls with a fresh token share one lookup.
      let inFlight = pending.get(cacheKey);
      if (!inFlight) {
        inFlight = load(token, cacheKey).finally(() => pending.delete(cacheKey));
        pending.set(cacheKey, inFlight);
      }
      return inFlight;
    },
    async reportRejected(token, product, credential) {
      cache.delete(sha256(token));
      try {
        await callIssuer("credentials/rejected", { token, product, keyId: credential.keyId }, async (response) => {
          void response.body?.cancel().catch(() => undefined);
          if (!response.ok && response.status !== 401) throw new Error(`report failed with status ${response.status}`);
        });
      } catch (error) {
        log("warn", "oauth.key.report_failed", { product, ...errorFields(error) });
      }
    },
    challenge(error) {
      const parts = [`resource_metadata="${metadataUrl}"`, `scope="${config.scopes.join(" ")}"`];
      if (error) parts.unshift(`error="${error}"`);
      return `Bearer ${parts.join(", ")}`;
    },
  };
}
