import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SalesforgeClient } from "../client.js";
import { handleTool } from "../helpers.js";

/** Register read-only tools for account credit balances and subscription details. */
export function registerAccountTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "get_credits",
    {
      description: "Get Salesforge account-wide credit balances for email, lead, personalization, email validation and social actions, including remaining, max, used and tierId. Lead credits show capacity for additional active contacts. Annual credit limits cover the billing period; lead capacity stays fixed. No workspace ID is needed.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => handleTool(() => client.coreGet("/credits")),
  );

  server.registerTool(
    "get_subscription",
    {
      description: "Get the Salesforge account's plan, billing period, subscription status, trial status, base plan credits and current credit tiers. Plan and tier allowances are monthly, except lead which is active-contact capacity. contactsAndEmailsTier covers both lead and email. No workspace ID is needed.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => handleTool(() => client.coreGet("/subscription")),
  );
}
