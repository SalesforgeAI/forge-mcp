import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerThreadTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_primebox_threads",
    {
      description:
        "List primebox threads (email replies) in a workspace. Use 'positive' filter to fetch positive replies. " +
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
        "Get full thread details including all emails in the conversation, sequence context, and contact information. " +
        "Use this after list_primebox_threads to get the complete thread before drafting a reply.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        mailboxId: z.string().describe("Mailbox ID (from list_primebox_threads response)"),
        threadId: z.string().describe("Thread ID (from list_primebox_threads response)"),
      },
    },
    ({ workspaceId, mailboxId, threadId }) =>
      handleTool(() =>
        client.coreGet(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/threads/${enc(threadId)}`,
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
        mailboxId: z.string().describe("Mailbox ID"),
        threadId: z.string().describe("Thread ID"),
        labelId: z.string().describe("New label ID to assign"),
      },
    },
    ({ workspaceId, mailboxId, threadId, labelId }) =>
      handleTool(() =>
        client.corePut(
          `/workspaces/${enc(workspaceId)}/mailboxes/${enc(mailboxId)}/threads/${enc(threadId)}/label`,
          { labelId },
        ),
      ),
  );
}
