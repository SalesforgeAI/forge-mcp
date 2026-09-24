import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

export function registerMailboxTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_mailboxes",
    {
      description: "List mailboxes in a workspace with optional filters",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results per page"),
        offset: z.number().optional().describe("Offset for pagination"),
        search: z.string().optional().describe("Search by mailbox email"),
        status: z.string().optional().describe("Filter by status"),
      },
    },
    ({ workspaceId, ...opts }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/mailboxes`, buildQuery(opts))),
  );

  server.registerTool(
    "get_mailbox",
    {
      description: "Get mailbox details by ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID"),
      },
    },
    ({ workspaceId, mailboxId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}`)),
  );

  server.registerTool(
    "download_email_attachments",
    {
      description: "Download all attachments from an email as a ZIP (returns content-type and base64-encoded data)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID"),
        emailId: z.string().describe("Email ID"),
      },
    },
    ({ workspaceId, mailboxId, emailId }) =>
      handleTool(() =>
        client.coreGetRaw(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/attachments`,
        ),
      ),
  );

  server.registerTool(
    "download_email_attachment",
    {
      description: "Download a single email attachment by content ID (returns content-type and base64-encoded data)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID"),
        emailId: z.string().describe("Email ID"),
        contentId: z.string().describe("Attachment content ID"),
      },
    },
    ({ workspaceId, mailboxId, emailId, contentId }) =>
      handleTool(() =>
        client.coreGetRaw(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/attachments/${enc(contentId)}`,
        ),
      ),
  );

  server.registerTool(
    "reply_to_email",
    {
      description:
        "Send a reply to an email thread. The reply is queued for sending (async). " +
        "Use get_thread to read the conversation first, then provide the email ID of the message to reply to. " +
        "The sender address is determined from the mailbox. The tool does not add a signature automatically; " +
        "use get_mailbox and include its resolvedSignature in the body when a signature is wanted. use `<div>&nbsp;</div>\n<div>--</div>` to separate the signature from the body.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID"),
        emailId: z.string().describe("Email ID to reply to (from get_thread response)"),
        body: z.string().describe("Reply body content (HTML supported)"),
        includeHistory: z
          .boolean()
          .optional()
          .describe("Include original email thread in reply (default: false)"),
        cc: z.array(z.string()).optional().describe("CC email addresses"),
        bcc: z.array(z.string()).optional().describe("BCC email addresses"),
      },
    },
    ({ workspaceId, mailboxId, emailId, body, includeHistory, cc, bcc }) =>
      handleTool(async () => {
        await client.corePost(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/reply`,
          { content: body, includeHistory, ccs: cc, bccs: bcc },
        );
        return { status: "accepted", message: "Reply queued for sending" };
      }),
  );
  server.registerTool("delete_mailbox", {
    description: "Delete a mailbox connection from Salesforge. Does not delete the email account at its provider.",
    inputSchema: { workspaceId: z.string().min(1), mailboxId: z.string().min(1) },
  }, ({ workspaceId, mailboxId }) =>
    handleTool(() => client.coreDelete(`/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}`)));

  const connection = z.object({
    host: z.string().min(1).describe("Mail server hostname"),
    port: z.number().int().min(1).max(65535),
    username: z.string().min(1),
    password: z.string().min(1).describe("Password or provider-issued app password"),
  });
  server.registerTool("update_mailbox_connection_settings", {
    description: "Update SMTP/IMAP credentials, including while connected. Only supports SMTP/IMAP mailboxes, not OAuth. Supply complete settings for at least one protocol; omitted protocols remain unchanged. Settings are verified before saving.",
    inputSchema: z.object({
      workspaceId: z.string().min(1),
      mailboxId: z.string().min(1),
      smtp: connection.optional(),
      imap: connection.optional(),
    }).refine(({ smtp, imap }) => smtp !== undefined || imap !== undefined, {
      message: "Provide smtp or imap settings",
    }),
  }, ({ workspaceId, mailboxId, ...body }) =>
    handleTool(() => client.corePatch(`/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/connection-settings`, body)));

}
