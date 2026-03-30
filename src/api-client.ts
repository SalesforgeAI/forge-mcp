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

export class ApiClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private product: string,
  ) {}

  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, query);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, undefined, body);
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
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
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
      "X-Source": "forge-mcp",
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const resp = await fetch(url, init);

    if (!resp.ok) {
      const text = await resp.text();
      throw new ApiError(resp.status, text, this.product);
    }

    if (resp.status === 204) {
      return {} as T;
    }

    return (await resp.json()) as T;
  }
}
