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
      description: "Send a reply to an email",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID"),
        emailId: z.string().describe("Email ID to reply to"),
        body: z.string().describe("Reply body (HTML supported)"),
        cc: z.array(z.string()).optional().describe("CC email addresses"),
        bcc: z.array(z.string()).optional().describe("BCC email addresses"),
      },
    },
    ({ workspaceId, mailboxId, emailId, ...payload }) =>
      handleTool(() =>
        client.corePost(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/reply`,
          payload,
        ),
      ),
  );
}
