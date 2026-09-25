import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerThreadTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_primebox_threads",
    {
      description:
        "List primebox threads (email and LinkedIn replies) in a workspace. Use 'positive' filter to fetch positive replies. " +
        "Combine with filter='unread' to get unanswered positive replies. " +
        "Returns thread ID, mailbox ID, contact info, subject, snippet, label, and read state for each thread.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        positive: z.boolean().optional().describe("Filter to positive replies only"),
        filter: z
          .enum(["all", "unread", "reminders"])
          .optional()
          .describe("Filter criteria: 'all', 'unread' (unanswered), or 'reminders'"),
        labels: z.array(z.string()).optional().describe("Filter by label IDs (include)"),
        excludeLabels: z.array(z.string()).optional().describe("Exclude threads with these label IDs"),
        mailboxIds: z.array(z.string()).optional().describe("Filter by mailbox IDs"),
        sequenceIds: z.array(z.string()).optional().describe("Filter by sequence IDs"),
        searchQuery: z.string().optional().describe("Search threads by keyword"),
        limit: z.number().optional().describe("Max results per page (default 10)"),
        offset: z.number().optional().describe("Offset for pagination"),
        isUnread: z.boolean().optional().describe("Filter unread threads only")
      },
    },
    ({ workspaceId, positive, filter, labels, excludeLabels, mailboxIds, sequenceIds, searchQuery, limit, offset }) =>
      handleTool(() => {
        const params = new URLSearchParams();
        if (positive !== undefined) params.set("positive", String(positive));
        if (filter) params.set("filter", filter);
        if (searchQuery) params.set("q", searchQuery);
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        if (labels) labels.forEach((l) => params.append("labels[]", l));
        if (excludeLabels) excludeLabels.forEach((l) => params.append("exclude_labels[]", l));
        if (mailboxIds) mailboxIds.forEach((id) => params.append("mailbox_ids[]", id));
        if (sequenceIds) sequenceIds.forEach((id) => params.append("sequence_ids[]", id));

        const qs = params.toString();
        const path = `/workspaces/${enc(workspaceId)}/threads${qs ? `?${qs}` : ""}`;
        return client.coreGet(path);
      }),
  );

  server.registerTool(
    "get_thread",
    {
      description:
        "Get full thread details including email and LinkedIn messages, sequence context, and contact information. " +
        "Use this after list_primebox_threads to get the complete thread before drafting a reply.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        threadId: z.string().describe("Thread ID (from list_primebox_threads response)"),
      },
    },
    ({ workspaceId, threadId }) =>
      handleTool(() =>
        client.coreGet(
          `/workspaces/${enc(workspaceId)}/threads/${enc(threadId)}`,
        ),
      ),
  );

  server.registerTool(
    "reply_to_linkedin_thread",
    {
      description:
        "Send a LinkedIn reply to the contact associated with an existing primebox thread. " +
        "Use get_thread to read the conversation first and obtain the sending LinkedIn accountId from its LinkedIn messages. " +
        "Supports LinkedIn-only threads without a mailbox ID. Returns the created LinkedIn message.",
      inputSchema: z.object({
        workspaceId: z.string().min(1).describe("Workspace ID"),
        threadId: z.string().min(1).describe("Thread ID (from list_primebox_threads response)"),
        accountId: z.number().int().positive().describe("Sending LinkedIn account ID (from get_thread LinkedIn messages)"),
        message: z.string().describe("Reply text; may be empty when sending attachments only"),
        attachments: z.array(z.object({
          filename: z.string().min(1).describe("Attachment filename including extension"),
          contentType: z.string().optional().describe("Attachment MIME type"),
          contentBase64: z.string().min(1).describe("Base64-encoded attachment content"),
        })).optional().describe("Optional LinkedIn attachments; file types and size limits are validated by the API"),
      }).refine(({ message, attachments }) => message.trim().length > 0 || (attachments?.length ?? 0) > 0, {
        message: "Provide reply text or at least one attachment",
      }),
    },
    ({ workspaceId, threadId, ...body }) =>
      handleTool(() =>
        client.corePost(
          `/workspaces/${enc(workspaceId)}/threads/${enc(threadId)}/linkedin/reply`,
          body,
        ),
      ),
  );

  server.registerTool(
    "list_primebox_labels",
    {
      description:
        "List all primebox labels (sentiment categories) for a workspace. " +
        "Labels include built-in ones like 'positive', 'negative', 'ooo', 'meeting_booked', etc. " +
        "Use label IDs with list_primebox_threads to filter by sentiment.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results per page (default 10)"),
        offset: z.number().optional().describe("Offset for pagination"),
      },
    },
    ({ workspaceId, ...opts }) =>
      handleTool(() => {
        const query: Record<string, string> = {};
        if (opts.limit !== undefined) query.limit = String(opts.limit);
        if (opts.offset !== undefined) query.offset = String(opts.offset);
        return client.coreGet(`/workspaces/${enc(workspaceId)}/primebox-labels`, query);
      }),
  );

  server.registerTool(
    "update_thread_label",
    {
      description:
        "Update the label (sentiment/status) of a thread. Use after replying to mark a thread as handled, " +
        "or to reclassify a thread's sentiment. Get available label IDs from list_primebox_labels.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        threadId: z.string().describe("Thread ID"),
        labelId: z.string().describe("New label ID to assign"),
      },
    },
    ({ workspaceId, threadId, labelId }) =>
      handleTool(() =>
        client.corePut(
          `/workspaces/${enc(workspaceId)}/threads/${enc(threadId)}/label`,
          { labelId },
        ),
      ),
  );
}
