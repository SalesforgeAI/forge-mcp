import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

export function registerDncTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_dnc_entries",
    {
      description: "List Do-Not-Contact entries (email addresses and domains) of a workspace",
      annotations: { readOnlyHint: true },
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().int().min(1).max(1000).optional().describe("Page size (default 100, maximum 1000)"),
        offset: z.number().int().min(0).optional().describe("Number of entries to skip"),
      },
    },
    ({ workspaceId, limit, offset }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/dnc`, buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "add_dnc_entries",
    {
      description: "Add multiple Do-Not-Contact entries to a workspace (up to 1000). Pass email addresses or domains as plain strings.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        dncs: z.array(z.string()).min(1).max(1000).describe("Email addresses or domains to block (plain strings, e.g. 'user@example.com' or 'example.com')"),
      },
    },
    ({ workspaceId, dncs }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/dnc/bulk`, { dncs })),
  );

  server.registerTool(
    "remove_dnc_entries",
    {
      description: "Remove multiple Do-Not-Contact entries from a workspace (up to 1000). Pass the same email addresses or domains that were added.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        dncs: z.array(z.string()).min(1).max(1000).describe("Email addresses or domains to unblock (plain strings, e.g. 'user@example.com' or 'example.com')"),
      },
    },
    ({ workspaceId, dncs }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/dnc/bulk/remove`, { dncs })),
  );
}
