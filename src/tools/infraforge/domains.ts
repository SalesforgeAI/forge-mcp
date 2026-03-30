import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerInfraforgeDomainTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "infraforge_check_domain_availability",
    {
      description: "Check domain availability in InfraForge",
      inputSchema: {
        domain: z.string().describe("Domain to check (FQDN)"),
      },
    },
    ({ domain }) =>
      handleTool(() => client.get("/check-domain-availability", buildQuery({ domain }))),
  );

  server.registerTool(
    "infraforge_check_domain_availability_bulk",
    {
      description: "Check availability of multiple domains in InfraForge",
      inputSchema: {
        domains: z.array(z.string()).describe("Domains to check"),
      },
    },
    ({ domains }) =>
      handleTool(() => client.post("/check-domain-availability-bulk", { domains })),
  );

  server.registerTool(
    "infraforge_list_domains",
    {
      description: "List InfraForge domains",
      inputSchema: {
        workspaceId: z.string().optional().describe("Filter by workspace"),
      },
    },
    ({ workspaceId }) =>
      handleTool(() => client.get("/domains", buildQuery({ workspaceId }))),
  );

  server.registerTool(
    "infraforge_purchase_domains",
    {
      description: "Purchase domains in InfraForge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Purchase payload with workspace, domains, and contact details"),
      },
    },
    ({ body }) => handleTool(() => client.post("/domains", body)),
  );

  server.registerTool(
    "infraforge_get_domain_dns",
    {
      description: "Get DNS records for an InfraForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) => handleTool(() => client.get(`/domains/${domainID}/dns`)),
  );

  server.registerTool(
    "infraforge_update_domain_dns",
    {
      description: "Update DNS records for an InfraForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
        records: z.array(z.object({
          name: z.string(),
          type: z.string(),
          value: z.string(),
          editable: z.boolean().optional(),
        })).describe("DNS records"),
      },
    },
    ({ domainID, records }) =>
      handleTool(() => client.put(`/domains/${domainID}/dns`, { records })),
  );

  server.registerTool(
    "infraforge_bulk_dns_update",
    {
      description: "Bulk update DNS across InfraForge domains",
      inputSchema: {
        domains: z.array(z.string()).describe("Domain names"),
        dmarcEmail: z.string().optional(),
        dmarcPolicy: z.string().optional(),
        forwardToDomain: z.string().optional(),
      },
    },
    (body) => handleTool(() => client.put("/domains/bulk-dns", body)),
  );

  server.registerTool(
    "infraforge_get_alternative_domains",
    {
      description: "Generate alternative domain suggestions",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Domain suggestion payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/domains/alternative-domains", body)),
  );

  server.registerTool(
    "infraforge_enable_autorenew",
    {
      description: "Enable auto-renewal for an InfraForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) =>
      handleTool(() => client.put(`/domains/${domainID}/enable-autorenew`, {})),
  );

  server.registerTool(
    "infraforge_disable_autorenew",
    {
      description: "Disable auto-renewal for an InfraForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) =>
      handleTool(() => client.put(`/domains/${domainID}/disable-autorenew`, {})),
  );
}
