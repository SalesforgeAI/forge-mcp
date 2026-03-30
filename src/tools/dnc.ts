import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerDncTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "add_dnc_entries",
    {
      description: "Add multiple Do-Not-Contact entries to a workspace",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        entries: z.array(
          z.object({
            value: z.string().describe("Email address or domain to block"),
            type: z.string().optional().describe("Type: email or domain"),
          }),
        ).describe("DNC entries to add"),
      },
    },
    ({ workspaceId, entries }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/dnc/bulk`, { entries })),
  );
}
