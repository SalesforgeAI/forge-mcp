import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

/** Register paginated workspace tag discovery. */
export function registerTagTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool("list_tags", {
    description: "List workspace tags with IDs and names, pagination, and optional name search.",
    inputSchema: {
      workspaceId: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional().describe("Page size, default 10"),
      offset: z.number().int().nonnegative().optional(),
      search: z.string().max(255).optional(),
      caseSensitive: z.boolean().optional().describe("Case-sensitive search, default false"),
    },
  }, ({ workspaceId, caseSensitive, ...options }) =>
    handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/tags`, buildQuery({
      ...options,
      caseSensitive: caseSensitive === undefined ? undefined : String(caseSensitive),
    }))));
}
