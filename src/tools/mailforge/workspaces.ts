import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

export function registerMailforgeWorkspaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "mailforge_list_workspaces",
    {
      description: "List all workspaces in MailForge",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/workspaces")),
  );

  server.registerTool(
    "mailforge_create_workspace",
    {
      description: "Create a workspace in MailForge",
      inputSchema: {
        name: z.string().describe("Workspace name"),
      },
    },
    ({ name }) => handleTool(() => client.post("/workspaces", { name })),
  );

  server.registerTool(
    "mailforge_update_workspace",
    {
      description: "Update a MailForge workspace name",
      inputSchema: {
        workspaceID: z.string().describe("Workspace ID"),
        name: z.string().describe("New workspace name"),
      },
    },
    ({ workspaceID, name }) =>
      handleTool(() => client.patch(`/workspaces/${workspaceID}`, { name })),
  );

  server.registerTool(
    "mailforge_delete_workspace",
    {
      description: "Delete a MailForge workspace",
      inputSchema: {
        workspaceID: z.string().describe("Workspace ID"),
      },
    },
    ({ workspaceID }) =>
      handleTool(() => client.delete(`/workspaces/${workspaceID}`)),
  );
}
