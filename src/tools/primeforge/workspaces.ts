import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery, enc } from "../../helpers.js";

export function registerPrimeforgeWorkspaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "primeforge_list_workspaces",
    {
      description: "List PrimeForge workspaces",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max results per page"),
        offset: z.number().int().min(0).optional().describe("Offset for pagination"),
      },
    },
    ({ limit, offset }) =>
      handleTool(() => client.get("/workspaces", buildQuery({ limit, offset }))),
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
      description:
        "Set the forwarding URL for domains in a PrimeForge workspace, so visitors to those domains are sent to that URL. " +
        "The domains must belong to the given workspace: IDs from other workspaces are skipped, and the call fails if none of them match.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID the domains belong to"),
        domainIds: z.array(z.string().min(1)).min(1).describe("Domain IDs (as returned by primeforge_list_domains), not domain names"),
        forwardingUrl: z.string().url().optional().describe("URL to forward the domains to, e.g. https://example.com"),
      },
    },
    ({ workspaceId, domainIds, forwardingUrl }) =>
      handleTool(() =>
        client.post(`/workspaces/${enc(workspaceId)}/domains/forwarding`, { domainIds, forwardingUrl }),
      ),
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
