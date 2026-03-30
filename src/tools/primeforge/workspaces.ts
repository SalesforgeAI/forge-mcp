import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerPrimeforgeWorkspaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "primeforge_list_workspaces",
    {
      description: "List PrimeForge workspaces",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/workspaces")),
  );

  server.registerTool(
    "primeforge_create_workspace",
    {
      description: "Create a PrimeForge workspace",
      inputSchema: {
        name: z.string().describe("Workspace name (1-50 chars)"),
      },
    },
    ({ name }) => handleTool(() => client.post("/workspaces", { name })),
  );

  server.registerTool(
    "primeforge_get_workspace",
    {
      description: "Get a PrimeForge workspace by ID",
      inputSchema: {
        id: z.string().describe("Workspace ID"),
      },
    },
    ({ id }) => handleTool(() => client.get(`/workspaces/${id}`)),
  );

  server.registerTool(
    "primeforge_delete_workspace",
    {
      description: "Delete a PrimeForge workspace",
      inputSchema: {
        id: z.string().describe("Workspace ID"),
      },
    },
    ({ id }) => handleTool(() => client.delete(`/workspaces/${id}`)),
  );

  server.registerTool(
    "primeforge_set_domain_forwarding",
    {
      description: "Set domain forwarding for a PrimeForge workspace",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        forwardToDomain: z.string().describe("Domain to forward to"),
      },
    },
    ({ workspaceId, forwardToDomain }) =>
      handleTool(() => client.post(`/workspaces/${workspaceId}/domains/forwarding`, { forwardToDomain })),
  );

  server.registerTool(
    "primeforge_export_mailboxes",
    {
      description: "Export PrimeForge mailboxes to a third-party platform",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        exportType: z.string().describe("Export type"),
        search: z.string().optional().describe("Search filter"),
        includedIds: z.array(z.string()).optional().describe("Mailbox IDs to include"),
        excludedIds: z.array(z.string()).optional().describe("Mailbox IDs to exclude"),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.post(`/workspaces/${workspaceId}/exports`, body)),
  );

  server.registerTool(
    "primeforge_export_to_salesforge",
    {
      description: "Export PrimeForge mailboxes to Salesforge",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        exportType: z.string().describe("Export type"),
        includedIds: z.array(z.string()).optional().describe("Mailbox IDs to include"),
        excludedIds: z.array(z.string()).optional().describe("Mailbox IDs to exclude"),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.post(`/workspaces/${workspaceId}/exports/salesforge`, body)),
  );
}
