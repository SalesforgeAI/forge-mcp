import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SalesforgeClient } from "./client.js";
import { ApiClient } from "./api-client.js";
import { registerIdentityTools } from "./tools/identity.js";
import { registerWorkspaceTools } from "./tools/workspaces.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerMailboxTools } from "./tools/mailboxes.js";
import { registerDncTools } from "./tools/dnc.js";
import { registerCustomVarTools } from "./tools/custom-vars.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerSequenceTools } from "./tools/sequences.js";
import { registerNodeTools } from "./tools/nodes.js";
import { registerBranchTools } from "./tools/branches.js";
import { registerEnrollmentTools } from "./tools/enrollments.js";
import { registerSenderProfileTools } from "./tools/sender-profiles.js";
import { registerValidationTools } from "./tools/validations.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerThreadTools } from "./tools/threads.js";
import { registerPrimeforgeWorkspaceTools } from "./tools/primeforge/workspaces.js";
import { registerPrimeforgeDomainTools } from "./tools/primeforge/domains.js";
import { registerPrimeforgeMailboxTools } from "./tools/primeforge/mailboxes.js";
import { registerLeadsforgeSearchTools } from "./tools/leadsforge/search.js";
import { registerLeadsforgeEnrichmentTools } from "./tools/leadsforge/enrichment.js";
import { registerLeadsforgeLookalikesTools } from "./tools/leadsforge/lookalikes.js";
import { registerInfraforgeWorkspaceTools } from "./tools/infraforge/workspaces.js";
import { registerInfraforgeDomainTools } from "./tools/infraforge/domains.js";
import { registerInfraforgeMailboxTools } from "./tools/infraforge/mailboxes.js";
import { registerInfraforgeCreditTools } from "./tools/infraforge/credits.js";
import { registerWarmforgeMailboxTools } from "./tools/warmforge/mailboxes.js";
import { registerWarmforgePlacementTestTools } from "./tools/warmforge/placement-tests.js";
import { registerMailforgeWorkspaceTools } from "./tools/mailforge/workspaces.js";
import { registerMailforgeDomainTools } from "./tools/mailforge/domains.js";
import { registerMailforgeMailboxTools } from "./tools/mailforge/mailboxes.js";

export interface ProductClients {
  salesforge?: SalesforgeClient;
  primeforge?: ApiClient;
  leadsforge?: ApiClient;
  infraforge?: ApiClient;
  warmforge?: ApiClient;
  mailforge?: ApiClient;
}

export function createServer(clients: ProductClients): McpServer {
  const server = new McpServer({
    name: "forge-mcp",
    version: "2.0.0",
  });

  if (clients.salesforge) {
    const c = clients.salesforge;
    registerIdentityTools(server, c);
    registerWorkspaceTools(server, c);
    registerContactTools(server, c);
    registerMailboxTools(server, c);
    registerDncTools(server, c);
    registerCustomVarTools(server, c);
    registerWebhookTools(server, c);
    registerSequenceTools(server, c);
    registerNodeTools(server, c);
    registerBranchTools(server, c);
    registerEnrollmentTools(server, c);
    registerSenderProfileTools(server, c);
    registerValidationTools(server, c);
    registerReferenceTools(server, c);
    registerThreadTools(server, c);
  }

  if (clients.primeforge) {
    const c = clients.primeforge;
    registerPrimeforgeWorkspaceTools(server, c);
    registerPrimeforgeDomainTools(server, c);
    registerPrimeforgeMailboxTools(server, c);
  }

  if (clients.leadsforge) {
    const c = clients.leadsforge;
    registerLeadsforgeSearchTools(server, c);
    registerLeadsforgeEnrichmentTools(server, c);
    registerLeadsforgeLookalikesTools(server, c);
  }

  if (clients.infraforge) {
    const c = clients.infraforge;
    registerInfraforgeWorkspaceTools(server, c);
    registerInfraforgeDomainTools(server, c);
    registerInfraforgeMailboxTools(server, c);
    registerInfraforgeCreditTools(server, c);
  }

  if (clients.warmforge) {
    const c = clients.warmforge;
    registerWarmforgeMailboxTools(server, c);
    registerWarmforgePlacementTestTools(server, c);
  }

  if (clients.mailforge) {
    const c = clients.mailforge;
    registerMailforgeWorkspaceTools(server, c);
    registerMailforgeDomainTools(server, c);
    registerMailforgeMailboxTools(server, c);
  }

  return server;
}

// Backward-compatible export
export function createSalesforgeServer(client: SalesforgeClient): McpServer {
  return createServer({ salesforge: client });
}
