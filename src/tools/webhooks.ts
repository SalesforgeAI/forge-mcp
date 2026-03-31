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
      description: "Create a new webhook. Each webhook subscribes to exactly one event type. To listen to multiple events, create multiple webhooks.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        name: z.string().describe("Webhook name"),
        url: z.string().describe("Webhook URL to receive events"),
        type: z.enum([
          "email_sent", "email_opened", "link_clicked", "email_replied",
          "linkedin_replied", "contact_unsubscribed", "email_bounced",
          "positive_reply", "negative_reply", "label_changed", "dnc_added",
        ]).describe("Event type to subscribe to"),
        sequenceId: z.string().optional().describe("Optional: scope this webhook to a specific sequence ID"),
      },
    },
    ({ workspaceId, name, url, type, sequenceId }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/integrations/webhooks`, {
        name,
        url,
        type,
        ...(sequenceId !== undefined && { sequenceID: sequenceId }),
      })),
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
