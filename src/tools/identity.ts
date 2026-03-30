import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SalesforgeClient } from "../client.js";
import { handleTool } from "../helpers.js";

export function registerIdentityTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool("get_me", { description: "Validate API key and get current account info (accountId, apiKeyName)" }, () =>
    handleTool(() => client.coreGet("/me")),
  );
}
