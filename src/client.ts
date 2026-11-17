import { log, loggedFetch } from "./logging.js";

const CORE_BASE_URL = "https://api.salesforge.ai/public/v2";
const MULTICHANNEL_BASE_URL = "https://multichannel-api.salesforge.ai/public";

/**
 * Salesforge answers 429 when an account goes over its public API rate limit. It rejects the request
 * before running it, so sending it again is safe whatever the method. A wait longer than
 * RATE_LIMIT_MAX_WAIT_MS goes back to the caller as the 429 error.
 */
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_MAX_WAIT_MS = 10_000;
const RATE_LIMIT_FALLBACK_BACKOFF_MS = 1_000;

export type QueryValue = string | readonly string[];
export type QueryParams = Record<string, QueryValue>;

export class SalesforgeApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
    /** How long Salesforge asked to wait before retrying, when it said. */
    public retryAfterMs?: number,
  ) {
    super(statusCode === 429 ? rateLimitMessage(body, retryAfterMs) : `Salesforge API error ${statusCode}: ${body}`);
    this.name = "SalesforgeApiError";
  }
}

/** Explain a 429, so the assistant waits instead of retrying at once or blaming its request. */
function rateLimitMessage(body: string, retryAfterMs?: number): string {
  const seconds = retryAfterMs === undefined ? undefined : Math.max(1, Math.ceil(retryAfterMs / 1000));
  const wait = seconds === undefined ? "a little while" : `${seconds} second${seconds === 1 ? "" : "s"}`;
  return `Salesforge API error 429: this account hit its Salesforge API rate limit. Wait ${wait} before ` +
    `trying again, and make fewer requests at once. Every API key and integration on the account shares ` +
    `this limit. ${body}`.trim();
}

/** Read Retry-After, given as seconds or as an HTTP date, in milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^-?\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds >= 0 ? seconds * 1000 : undefined;
  }
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? undefined : Math.max(at - now, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SalesforgeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("SALESFORGE_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  async coreGet<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", CORE_BASE_URL, path, query);
  }

  async corePost<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", CORE_BASE_URL, path, undefined, body);
  }

  /** Patch fields on a core Salesforge resource. */
  async corePatch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", CORE_BASE_URL, path, undefined, body);
  }

  /** Delete a core Salesforge resource. */
  async coreDelete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", CORE_BASE_URL, path);
  }

  async corePut<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", CORE_BASE_URL, path, undefined, body);
  }

  async mcGet<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", MULTICHANNEL_BASE_URL, path, query);
  }

  async mcPost<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", MULTICHANNEL_BASE_URL, path, undefined, body);
  }

  async mcPatch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", MULTICHANNEL_BASE_URL, path, undefined, body);
  }

  async mcPut<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", MULTICHANNEL_BASE_URL, path, undefined, body);
  }

  async mcDelete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", MULTICHANNEL_BASE_URL, path);
  }

  async coreGetRaw(path: string): Promise<{ contentType: string; data: string }> {
    const url = `${CORE_BASE_URL}${path}`;
    return this.withRateLimitRetry(() => loggedFetch("Salesforge", url, {
      method: "GET",
      headers: { Authorization: this.apiKey, "X-Source": "forge-mcp" },
    }, async (resp) => {
      if (!resp.ok) {
        const body = await resp.text();
        throw new SalesforgeApiError(resp.status, body, parseRetryAfter(resp.headers.get("retry-after")));
      }
      const buffer = await resp.arrayBuffer();
      return {
        contentType: resp.headers.get("content-type") ?? "application/octet-stream",
        data: Buffer.from(buffer).toString("base64"),
      };
    }));
  }

  /** Send a request again after a 429, waiting as long as Salesforge asks. */
  private async withRateLimitRetry<T>(send: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await send();
      } catch (error) {
        if (!(error instanceof SalesforgeApiError) || error.statusCode !== 429 || attempt >= RATE_LIMIT_MAX_RETRIES) {
          throw error;
        }
        const waitMs = error.retryAfterMs ?? RATE_LIMIT_FALLBACK_BACKOFF_MS * 2 ** attempt;
        if (waitMs > RATE_LIMIT_MAX_WAIT_MS) throw error;
        log("warn", "upstream.request.rate_limited", { product: "Salesforge", attempt: attempt + 1, waitMs });
        await sleep(waitMs);
      }
    }
  }

  private async request<T>(
    method: string,
    baseUrl: string,
    path: string,
    query?: QueryParams,
    body?: unknown,
  ): Promise<T> {
    let url = `${baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
          for (const item of value) params.append(key, String(item));
        } else {
          params.append(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      Accept: "application/json",
      "X-Source": "forge-mcp",
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    return this.withRateLimitRetry(() => loggedFetch("Salesforge", url, init, async (resp) => {
      if (!resp.ok) {
        const text = await resp.text();
        throw new SalesforgeApiError(resp.status, text, parseRetryAfter(resp.headers.get("retry-after")));
      }

      // 204 No Content has no body; 202 Accepted may omit one too
      const text = await resp.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    }));
  }
}
