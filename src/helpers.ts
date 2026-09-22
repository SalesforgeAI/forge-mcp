type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export async function handleTool<T>(fn: () => Promise<T>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
}

export function enc(value: string): string {
  return encodeURIComponent(value);
}

export function buildQuery(
  params: Record<string, string | number | string[] | undefined>,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === "") continue;
    if (Array.isArray(val)) {
      if (val.length > 0) query[key] = val;
      continue;
    }
    query[key] = String(val);
  }
  return query;
}
