import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { idSchema, pageSchema, sizeSchema } from "./schemas.js";

const webhookId = idSchema.describe("Webhook endpoint ID");

export function registerCalendioWebhookTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "calendio_list_webhooks",
    {
      description: "List Calendio webhook endpoints (paginated)",
      inputSchema: z.strictObject({ page: pageSchema, size: sizeSchema }),
    },
    ({ page, size }) => handleTool(() => client.get("/webhook-endpoints", buildQuery({ page, size }))),
  );

  server.registerTool(
    "calendio_create_webhook",
    {
      description: "Create a Calendio webhook endpoint. The response holds the signing secret, and Calendio never shows it again.",
      inputSchema: z.strictObject({
        url: z.url().describe("URL that receives the events"),
        events: z
          .array(z.enum([
            "link.viewed",
            "meeting.booked",
            "meeting.rescheduled",
            "meeting.cancelled",
            "meeting.host-changed",
            "meeting.held",
            "meeting.no-show",
            "meeting.outcome-corrected",
          ]))
          .min(1),
        description: z.string().optional(),
      }),
    },
    ({ url, events, description }) =>
      handleTool(() => client.post("/webhook-endpoints", { url, events, description })),
  );

  server.registerTool(
    "calendio_get_webhook",
    {
      description: "Get a Calendio webhook endpoint by ID",
      inputSchema: z.strictObject({ id: webhookId }),
    },
    ({ id }) => handleTool(() => client.get(`/webhook-endpoints/${enc(id)}`)),
  );

  server.registerTool(
    "calendio_delete_webhook",
    {
      description: "Delete a Calendio webhook endpoint",
      inputSchema: z.strictObject({ id: webhookId }),
    },
    ({ id }) => handleTool(() => client.delete(`/webhook-endpoints/${enc(id)}`)),
  );
}
