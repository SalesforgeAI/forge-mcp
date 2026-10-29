import { isRevokedKey, revokedKeyMessage } from "./api-client.js";
import { loggedFetch } from "./logging.js";

// Production unless the deployment points at another environment, such as dev.
const CORE_BASE_URL = process.env.SALESFORGE_API_URL?.trim() || "https://api.salesforge.ai/public/v2";
const MULTICHANNEL_BASE_URL = process.env.SALESFORGE_MULTICHANNEL_API_URL?.trim() || "https://multichannel-api.salesforge.ai/public";

export type QueryValue = string | readonly string[];
export type QueryParams = Record<string, QueryValue>;

export class SalesforgeApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
  ) {
    super(`Salesforge API error ${statusCode}: ${body}`);
    this.name = "SalesforgeApiError";
  }
}

export class SalesforgeClient {
  private apiKey: string;
  private onUnauthorized?: () => void;

  constructor(apiKey: string, onUnauthorized?: () => void) {
    if (!apiKey) {
      throw new Error("SALESFORGE_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.onUnauthorized = onUnauthorized;
  }

  /** Multichannel validates the same Salesforge key, so a 401 from either service means the key is gone. */
  private rejectRevokedKey(resp: Response): void {
    if (isRevokedKey(resp, this.onUnauthorized)) throw new SalesforgeApiError(401, revokedKeyMessage("Salesforge"));
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
    return loggedFetch("Salesforge", url, {
      method: "GET",
      headers: { Authorization: this.apiKey, "X-Source": "forge-mcp" },
    }, async (resp) => {
      this.rejectRevokedKey(resp);
      if (!resp.ok) {
        const body = await resp.text();
        throw new SalesforgeApiError(resp.status, body);
      }
      const buffer = await resp.arrayBuffer();
      return {
        contentType: resp.headers.get("content-type") ?? "application/octet-stream",
        data: Buffer.from(buffer).toString("base64"),
      };
    });
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

    return loggedFetch("Salesforge", url, init, async (resp) => {
      this.rejectRevokedKey(resp);
      if (!resp.ok) {
        const text = await resp.text();
        throw new SalesforgeApiError(resp.status, text);
      }

      // 204 No Content has no body; 202 Accepted may omit one too
      const text = await resp.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    });
  }
}
