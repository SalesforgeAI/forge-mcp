import { loggedFetch } from "./logging.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
    public product: string,
  ) {
    super(`${product} API error ${statusCode}: ${body}`);
    this.name = "ApiError";
  }
}

/** The error a tool shows when a product rejects a managed key, instead of the product's raw 401 body. */
export function revokedKeyMessage(product: string): string {
  return `${product} no longer accepts this connection's API key; it may have been deleted in ${product} settings. ` +
    "Reconnect the Salesforge connector to restore access.";
}

/**
 * `onUnauthorized` is set for OAuth connections only: their key is a managed one, so a 401 means the user revoked
 * it in the product. Reports it and drops the body; the caller then throws with revokedKeyMessage.
 */
export function isRevokedKey(resp: Response, onUnauthorized?: () => void): boolean {
  if (resp.status !== 401 || !onUnauthorized) return false;
  onUnauthorized();
  void resp.body?.cancel().catch(() => undefined);
  return true;
}

export class ApiClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private product: string,
    private onUnauthorized?: () => void,
  ) {}

  async get<T>(path: string, query?: Record<string, string | string[]>): Promise<T> {
    return this.request<T>("GET", path, query);
  }

  async post<T>(
    path: string,
    body?: unknown,
    query?: Record<string, string | string[]>,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("POST", path, query, body, headers);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, undefined, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, undefined, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    query?: Record<string, string | string[]>,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === "") continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item !== undefined && item !== "") params.append(key, item);
          }
          continue;
        }
        params.set(key, val);
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      Accept: "application/json",
      "X-Source": "forge-mcp",
      ...extraHeaders,
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    return loggedFetch(this.product, url, init, async (resp) => {
      if (isRevokedKey(resp, this.onUnauthorized)) throw new ApiError(401, revokedKeyMessage(this.product), this.product);
      if (!resp.ok) {
        const text = await resp.text();
        throw new ApiError(resp.status, text, this.product);
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
