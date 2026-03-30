import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SalesforgeClient } from "../client.js";
import { handleTool } from "../helpers.js";

export function registerReferenceTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_action_types",
    { description: "List all available action types for multichannel sequence nodes (email, LinkedIn, etc.)" },
    () => handleTool(() => client.mcGet("/multichannel/actions")),
  );

  server.registerTool(
    "list_condition_types",
    { description: "List all available condition types for multichannel sequence branching logic" },
    () => handleTool(() => client.mcGet("/multichannel/conditions")),
  );
}
