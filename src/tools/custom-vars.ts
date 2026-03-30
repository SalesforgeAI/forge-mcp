import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerCustomVarTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_custom_variables",
    {
      description: "List all custom variables in a workspace",
      inputSchema: { workspaceId: z.string().describe("Workspace ID") },
    },
    ({ workspaceId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/custom-vars`)),
  );
}
