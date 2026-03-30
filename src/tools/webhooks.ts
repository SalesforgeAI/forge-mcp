import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerWebhookTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_webhooks",
    {
      description: "List all webhooks in a workspace",
      inputSchema: { workspaceId: z.string().describe("Workspace ID") },
    },
    ({ workspaceId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/integrations/webhooks`)),
  );

  server.registerTool(
    "create_webhook",
    {
      description: "Create a new webhook. Events: email_sent, email_opened, link_clicked, email_replied, linkedin_replied, contact_unsubscribed, email_bounced, positive_reply, negative_reply, label_changed, dnc_added",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        url: z.string().describe("Webhook URL to receive events"),
        events: z.array(z.string()).describe("Event types to subscribe to"),
      },
    },
    ({ workspaceId, url, events }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/integrations/webhooks`, { url, events })),
  );

  server.registerTool(
    "get_webhook",
    {
      description: "Get webhook details by ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        webhookId: z.string().describe("Webhook ID"),
      },
    },
    ({ workspaceId, webhookId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/integrations/webhooks/${enc(webhookId)}`)),
  );
}
