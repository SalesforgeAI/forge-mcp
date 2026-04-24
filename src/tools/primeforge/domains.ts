import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerPrimeforgeDomainTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "primeforge_list_domains",
    {
      description: "List domains in PrimeForge",
      inputSchema: {
        workspaceId: z.string().optional().describe("Filter by workspace ID"),
      },
    },
    ({ workspaceId }) =>
      handleTool(() => client.get("/domains", buildQuery({ workspaceId }))),
  );

  server.registerTool(
    "primeforge_get_domain",
    {
      description: "Get a PrimeForge domain by ID",
      inputSchema: {
        id: z.string().describe("Domain ID"),
      },
    },
    ({ id }) => handleTool(() => client.get(`/domains/${id}`)),
  );

  server.registerTool(
    "primeforge_search_domains",
    {
      description: "Search available domains for purchase in PrimeForge",
      inputSchema: {
        domain: z.string().describe("Domain to search (FQDN)"),
        check_google_workspace: z.boolean().optional().describe("Check Google Workspace availability"),
        check_ms365_workspace: z.boolean().optional().describe("Check MS365 availability"),
      },
    },
    ({ domain, check_google_workspace, check_ms365_workspace }) =>
      handleTool(() => client.get("/domains/search-available", buildQuery({
        domain,
        check_google_workspace: check_google_workspace?.toString(),
        check_ms365_workspace: check_ms365_workspace?.toString(),
      }))),
  );

  server.registerTool(
    "primeforge_buy_domains",
    {
      description: "Purchase domains in PrimeForge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Domain purchase payload with platform, contactDetails, workspaceId, and domains array"),
      },
    },
    ({ body }) => handleTool(() => client.post("/domains", body)),
  );

  server.registerTool(
    "primeforge_delete_domain",
    {
      description: "Delete a PrimeForge domain",
      inputSchema: {
        id: z.string().describe("Domain ID"),
      },
    },
    ({ id }) => handleTool(() => client.delete(`/domains/${id}`)),
  );

  server.registerTool(
    "primeforge_get_domain_dns",
    {
      description: "Get DNS records for a PrimeForge domain",
      inputSchema: {
        domainId: z.string().describe("Domain ID"),
      },
    },
    ({ domainId }) => handleTool(() => client.get(`/domains/${domainId}/dns`)),
  );

  server.registerTool(
    "primeforge_bulk_dns_update",
    {
      description: "Bulk update DNS records across PrimeForge domains",
      inputSchema: {
        domains: z.array(z.string()).describe("Domain names"),
        dmarcEmail: z.string().optional().describe("DMARC email"),
        forwardToDomain: z.string().optional().describe("Forwarding domain"),
      },
    },
    ({ ...body }) => handleTool(() => client.put("/domains/bulk-dns", body)),
  );

  server.registerTool(
    "primeforge_create_mailboxes_for_domain",
    {
      description: "Create mailboxes for a PrimeForge domain",
      inputSchema: {
        domainId: z.string().describe("Domain ID"),
        workspaceId: z.string().describe("Workspace ID"),
        mailboxes: z.array(z.object({
          firstName: z.string(),
          lastName: z.string(),
          username: z.string(),
          signature: z.string(),
          profilePictureUrl: z.string(),
          forwardingEmail: z.string().optional(),
        })).describe("Mailboxes to create"),
      },
    },
    ({ domainId, workspaceId, mailboxes }) =>
      handleTool(() => client.post(`/domains/${domainId}/mailboxes`, { workspaceId, mailboxes })),
  );
}
