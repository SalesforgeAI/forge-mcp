import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

export function registerMailforgeMailboxTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "mailforge_list_mailboxes",
    {
      description: "List all mailboxes in MailForge",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/mailboxes")),
  );

  server.registerTool(
    "mailforge_get_mailbox",
    {
      description: "Get a specific MailForge mailbox by ID",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
      },
    },
    ({ mailboxID }) => handleTool(() => client.get(`/mailboxes/${mailboxID}`)),
  );

  server.registerTool(
    "mailforge_purchase_mailboxes",
    {
      description: "Purchase mailboxes in MailForge",
      inputSchema: {
        mailboxes: z.array(z.object({
          email: z.string().describe("Email address for the mailbox"),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          forwardingEmail: z.string().optional(),
          signature: z.string().optional(),
        })).describe("Mailboxes to create"),
      },
    },
    ({ mailboxes }) =>
      handleTool(() => client.post("/mailboxes", { mailboxes })),
  );

  server.registerTool(
    "mailforge_update_mailbox",
    {
      description: "Update a MailForge mailbox",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        password: z.string().optional(),
        signature: z.string().optional(),
        forwardingEmail: z.string().optional(),
      },
    },
    ({ mailboxID, ...body }) =>
      handleTool(() => client.patch(`/mailboxes/${mailboxID}`, body)),
  );

  server.registerTool(
    "mailforge_delete_mailbox",
    {
      description: "Delete a MailForge mailbox",
      inputSchema: {
        mailboxID: z.string().describe("Mailbox ID"),
      },
    },
    ({ mailboxID }) =>
      handleTool(() => client.delete(`/mailboxes/${mailboxID}`)),
  );

  server.registerTool(
    "mailforge_bulk_forward_mailboxes",
    {
      description: "Set forwarding email for multiple MailForge mailboxes",
      inputSchema: {
        forwardingEmail: z.string().describe("Email to forward to"),
        search: z.string().optional().describe("Filter mailboxes by search term"),
        includedIds: z.array(z.string()).optional().describe("Mailbox IDs to include"),
        excludedIds: z.array(z.string()).optional().describe("Mailbox IDs to exclude"),
      },
    },
    (body) => handleTool(() => client.post("/mailboxes/bulk-forward", body)),
  );

  server.registerTool(
    "mailforge_adjust_topup_amount",
    {
      description: "Adjust the mailbox top-up amount in MailForge",
      inputSchema: {
        amount: z.number().describe("New top-up amount"),
      },
    },
    ({ amount }) =>
      handleTool(() => client.post("/adjust-mailbox-topup-amount", { amount })),
  );
}
