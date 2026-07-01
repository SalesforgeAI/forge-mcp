import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";

export function registerWarmforgeWorkspaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "warmforge_list_workspaces",
    {
      description:
        "List Warmforge workspaces for the API key account. Use workspaces[].id as workspaceId when using account-wide API keys.",
      inputSchema: {
        page: z.number().describe("Page number (starts at 1)"),
        page_size: z.number().describe("Results per page (1-100)"),
      },
    },
    ({ page, page_size }) =>
      handleTool(() => client.get("/workspaces", buildQuery({ page, page_size }))),
  );

  server.registerTool(
    "warmforge_create_workspace",
    {
      description:
        "Create a Warmforge workspace. Requires an account-wide API key (default for new keys).",
      inputSchema: {
        name: z.string().describe("Workspace name"),
      },
    },
    ({ name }) => handleTool(() => client.post("/workspaces", { name })),
  );
}

export function warmforgeWorkspacePath(workspaceId: string, suffix: string): string {
  return `/workspaces/${enc(workspaceId)}${suffix}`;
}

export function resolveWarmforgePath(workspaceId: string | undefined, suffix: string): string {
  if (workspaceId) {
    return warmforgeWorkspacePath(workspaceId, suffix);
  }

  return suffix;
}

export const optionalWorkspaceIdSchema = z
  .string()
  .optional()
  .describe(
    "Warmforge workspace ID. Required for account-wide API keys. Omit for legacy workspace-scoped keys.",
  );
