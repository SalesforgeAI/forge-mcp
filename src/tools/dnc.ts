import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerDncTools(server: McpServer, client: SalesforgeClient) {
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
}
