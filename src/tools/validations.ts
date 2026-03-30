import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerValidationTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "start_email_validation",
    {
      description: "Start an email validation run for contacts in a workspace",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        filters: z.record(z.string(), z.any()).optional().describe("Filters to select contacts for validation"),
      },
    },
    ({ workspaceId, filters }) =>
      handleTool(() =>
        client.mcPost(`/multichannel/workspaces/${enc(workspaceId)}/validations`, filters ? { filters } : {}),
      ),
  );

  server.registerTool(
    "get_validation_results",
    {
      description: "Get results of an email validation run",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        runId: z.string().describe("Validation run ID"),
      },
    },
    ({ workspaceId, runId }) =>
      handleTool(() =>
        client.mcGet(`/multichannel/workspaces/${enc(workspaceId)}/validations/${enc(runId)}/results`),
      ),
  );
}
