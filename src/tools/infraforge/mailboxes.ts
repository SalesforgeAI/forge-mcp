import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerInfraforgeMailboxTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "infraforge_list_mailboxes",
    {
      description: "List InfraForge mailboxes",
      inputSchema: {
        workspaceId: z.string().optional().describe("Filter by workspace"),
        page: z.number().optional().describe("Page number"),
        size: z.number().optional().describe("Page size"),
        search: z.string().optional().describe("Search filter"),
      },
    },
    ({ workspaceId, page, size, search }) =>
      handleTool(() => client.get("/mailboxes", buildQuery({ workspaceId, page, size, search }))),
  );

  server.registerTool(
    "infraforge_get_mailbox",
    {
      description: "Get an InfraForge mailbox by ID",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
      },
    },
    ({ mailboxID }) => handleTool(() => client.get(`/mailboxes/${mailboxID}`)),
  );

  server.registerTool(
    "infraforge_update_mailbox",
    {
      description: "Update an InfraForge mailbox",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        signature: z.string().optional(),
        forwardingEmail: z.string().optional(),
      },
    },
    ({ mailboxID, ...body }) =>
      handleTool(() => client.patch(`/mailboxes/${mailboxID}`, body)),
  );

  server.registerTool(
    "infraforge_purchase_mailboxes",
    {
      description: "Purchase new mailboxes in InfraForge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Mailbox purchase payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes", body)),
  );

  server.registerTool(
    "infraforge_delete_mailbox",
    {
      description: "Delete an InfraForge mailbox",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
      },
    },
    ({ mailboxID }) => handleTool(() => client.delete(`/mailboxes/${mailboxID}`)),
  );

  server.registerTool(
    "infraforge_generate_mailboxes",
    {
      description: "Generate mailbox configurations for InfraForge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Generation payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/generate", body)),
  );

  server.registerTool(
    "infraforge_bulk_forward_mailboxes",
    {
      description: "Bulk set forwarding for InfraForge mailboxes",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Bulk forwarding payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/bulk-forward", body)),
  );
}
