import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerMailforgeDomainTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "mailforge_list_domains",
    {
      description: "List domains in MailForge, optionally filtered by status",
      inputSchema: {
        status: z.enum(["active", "pending", "failed", "expired"]).optional().describe("Filter by domain status"),
      },
    },
    ({ status }) =>
      handleTool(() => client.get("/domains", buildQuery({ status }))),
  );

  server.registerTool(
    "mailforge_purchase_domains",
    {
      description: "Purchase domains in MailForge",
      inputSchema: {
        domains: z.array(z.string()).describe("Domain names to purchase"),
        workspaceId: z.string().describe("Workspace ID"),
        contactDetails: z.record(z.string(), z.any()).describe("Contact details (firstName, lastName, email, organization, address1, city, province, postalCode, country, phone)"),
      },
    },
    ({ domains, workspaceId, contactDetails }) =>
      handleTool(() => client.post("/domains", { domains, workspaceId, contactDetails })),
  );

  server.registerTool(
    "mailforge_check_domain_availability",
    {
      description: "Check if a domain is available for purchase in MailForge",
      inputSchema: {
        domain: z.string().describe("Domain to check"),
      },
    },
    ({ domain }) =>
      handleTool(() => client.get("/check-domain-availability", buildQuery({ domain }))),
  );

  server.registerTool(
    "mailforge_check_domain_availability_bulk",
    {
      description: "Check availability of multiple domains in MailForge (max 100)",
      inputSchema: {
        domains: z.array(z.string()).describe("Domains to check"),
      },
    },
    ({ domains }) =>
      handleTool(() => client.post("/check-domain-availability-bulk", { domains })),
  );

  server.registerTool(
    "mailforge_transfer_domains",
    {
      description: "Transfer domains into MailForge",
      inputSchema: {
        domains: z.array(z.string()).describe("Domains to transfer"),
        workspaceId: z.string().describe("Target workspace ID"),
        dmarcEmail: z.string().optional().describe("DMARC report email"),
        forwardToDomain: z.string().optional().describe("Domain to forward to"),
      },
    },
    (body) => handleTool(() => client.post("/domains/transfer", body)),
  );

  server.registerTool(
    "mailforge_get_domain_dns",
    {
      description: "Get DNS records for a MailForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) => handleTool(() => client.get(`/domains/${domainID}/dns`)),
  );

  server.registerTool(
    "mailforge_update_domain_dns",
    {
      description: "Update DNS records for a MailForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
        records: z.array(z.object({
          name: z.string(),
          type: z.string(),
          value: z.string(),
          editable: z.boolean().optional(),
        })).describe("DNS records to set"),
      },
    },
    ({ domainID, records }) =>
      handleTool(() => client.put(`/domains/${domainID}/dns`, { records })),
  );

  server.registerTool(
    "mailforge_bulk_dns_update",
    {
      description: "Bulk update DNS across multiple MailForge domains",
      inputSchema: {
        domains: z.array(z.string()).describe("Domain names"),
        dmarcEmail: z.string().optional(),
        dmarcPolicy: z.string().optional(),
        forwardToDomain: z.string().optional(),
        removeENOMRecords: z.boolean().optional(),
      },
    },
    (body) => handleTool(() => client.put("/domains/bulk-dns", body)),
  );

  server.registerTool(
    "mailforge_enable_autorenew",
    {
      description: "Enable auto-renewal for a MailForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) =>
      handleTool(() => client.put(`/domains/${domainID}/enable-autorenew`, {})),
  );

  server.registerTool(
    "mailforge_disable_autorenew",
    {
      description: "Disable auto-renewal for a MailForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) =>
      handleTool(() => client.put(`/domains/${domainID}/disable-autorenew`, {})),
  );

  server.registerTool(
    "mailforge_bulk_enable_autorenew",
    {
      description: "Enable auto-renewal for multiple MailForge domains",
      inputSchema: {
        domainIds: z.array(z.string()).describe("Domain IDs"),
      },
    },
    ({ domainIds }) =>
      handleTool(() => client.post("/domains/bulk-enable-autorenew", { domainIds })),
  );

  server.registerTool(
    "mailforge_bulk_disable_autorenew",
    {
      description: "Disable auto-renewal for multiple MailForge domains",
      inputSchema: {
        domainIds: z.array(z.string()).describe("Domain IDs"),
      },
    },
    ({ domainIds }) =>
      handleTool(() => client.post("/domains/bulk-disable-autorenew", { domainIds })),
  );

  server.registerTool(
    "mailforge_update_domain_forwards",
    {
      description: "Update forwarding settings for MailForge domains",
      inputSchema: {
        forwards: z.array(z.object({
          domainId: z.string(),
          forwardToDomain: z.string(),
          domainMasking: z.boolean().optional(),
        })).describe("Forwarding configurations"),
      },
    },
    ({ forwards }) =>
      handleTool(() => client.patch("/domains/forwards", forwards)),
  );

  server.registerTool(
    "mailforge_purchase_domain_masking",
    {
      description: "Purchase domain masking for MailForge domains",
      inputSchema: {
        domainIds: z.array(z.string()).describe("Domain IDs"),
        purchaseMasking: z.boolean().describe("Whether to purchase masking"),
        isYearly: z.boolean().optional().describe("Yearly billing"),
      },
    },
    (body) => handleTool(() => client.post("/domains/masking", body)),
  );

  server.registerTool(
    "mailforge_delete_domain_masking",
    {
      description: "Delete domain masking for a MailForge domain",
      inputSchema: {
        domainID: z.string().describe("Domain ID"),
      },
    },
    ({ domainID }) =>
      handleTool(() => client.delete(`/domains/${domainID}/masking`)),
  );
}
