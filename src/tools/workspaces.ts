import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

export function registerWorkspaceTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_workspaces",
    {
      description: "List all workspaces (paginated)",
      inputSchema: { limit: z.number().optional().describe("Max results per page"), offset: z.number().optional().describe("Offset for pagination") },
    },
    ({ limit, offset }) => handleTool(() => client.coreGet("/workspaces", buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "create_workspace",
    {
      description: "Create a new workspace",
      inputSchema: { name: z.string().describe("Workspace name") },
    },
    ({ name }) => handleTool(() => client.corePost("/workspaces", { name })),
  );

  server.registerTool(
    "get_workspace",
    {
      description: "Get workspace details by ID",
      inputSchema: { workspaceId: z.string().describe("Workspace ID") },
    },
    ({ workspaceId }) => handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}`)),
  );
}
