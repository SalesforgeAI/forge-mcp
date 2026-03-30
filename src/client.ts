const CORE_BASE_URL = "https://api.salesforge.ai/public/v2";
const MULTICHANNEL_BASE_URL = "https://multichannel-api.salesforge.ai/public";

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

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("SALESFORGE_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  async coreGet<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", CORE_BASE_URL, path, query);
  }

  async corePost<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", CORE_BASE_URL, path, undefined, body);
  }

  async mcGet<T>(path: string, query?: Record<string, string>): Promise<T> {
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
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: this.apiKey },
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new SalesforgeApiError(resp.status, body);
    }
    const buffer = await resp.arrayBuffer();
    return {
      contentType: resp.headers.get("content-type") ?? "application/octet-stream",
      data: Buffer.from(buffer).toString("base64"),
    };
  }

  private async request<T>(
    method: string,
    baseUrl: string,
    path: string,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    let url = `${baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
      );
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      Accept: "application/json",
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const resp = await fetch(url, init);

    if (!resp.ok) {
      const text = await resp.text();
      throw new SalesforgeApiError(resp.status, text);
    }

    // Some DELETE endpoints return 204 No Content
    if (resp.status === 204) {
      return {} as T;
    }

    return (await resp.json()) as T;
  }
}
