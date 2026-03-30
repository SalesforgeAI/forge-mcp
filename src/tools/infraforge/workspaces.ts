import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerInfraforgeWorkspaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "infraforge_list_workspaces",
    {
      description: "List InfraForge workspaces",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/workspaces")),
  );

  server.registerTool(
    "infraforge_create_workspace",
    {
      description: "Create an InfraForge workspace",
      inputSchema: {
        name: z.string().describe("Workspace name (1-50 chars)"),
        attachUniqueIp: z.boolean().optional().describe("Attach a unique IP"),
      },
    },
    (body) => handleTool(() => client.post("/workspaces", body)),
  );

  server.registerTool(
    "infraforge_update_workspace",
    {
      description: "Update an InfraForge workspace",
      inputSchema: {
        workspaceID: z.string().describe("Workspace ID"),
        name: z.string().optional().describe("New name"),
      },
    },
    ({ workspaceID, ...body }) =>
      handleTool(() => client.patch(`/workspaces/${workspaceID}`, body)),
  );

  server.registerTool(
    "infraforge_delete_workspace",
    {
      description: "Delete an InfraForge workspace",
      inputSchema: {
        workspaceID: z.string().describe("Workspace ID"),
      },
    },
    ({ workspaceID }) => handleTool(() => client.delete(`/workspaces/${workspaceID}`)),
  );

  server.registerTool(
    "infraforge_export_mailboxes",
    {
      description: "Export InfraForge mailboxes",
      inputSchema: {
        workspaceID: z.string().describe("Workspace ID"),
        body: z.record(z.string(), z.any()).describe("Export payload"),
      },
    },
    ({ workspaceID, body }) =>
      handleTool(() => client.post(`/workspaces/${workspaceID}/mailboxes/export`, body)),
  );

  server.registerTool(
    "infraforge_export_to_salesforge",
    {
      description: "Export InfraForge mailboxes to Salesforge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Export payload with mailbox IDs"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/export-to-salesforge", body)),
  );
}
