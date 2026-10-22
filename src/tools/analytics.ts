import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

const MAX_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Count the days from `from` to `to`, both inclusive. */
function windowDays(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

const leadStatuses = [
  "active", "paused", "completed", "failed", "replied", "out_of_office", "unsubscribed",
  "dnc", "bounced", "bounce-shield", "company_limit_reached", "stop_on_reply",
] as const;

/** Register read-only multichannel analytics tools. */
export function registerAnalyticsTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sent_messages",
    {
      description: [
        "List sent emails and LinkedIn messages for 1-10 multichannel sequences within a date window of at most 30 days (fromDate and toDate are both required and inclusive).",
        "Each message includes the contact, sender, subject, content, sentAt, and engagement: firstOpenedAt, openCount, clickCount, repliedAt, positiveReply, and bouncedAt. Optional fields are omitted when they do not apply. Open and click counts are always 0 for LinkedIn.",
        "Results are ordered by send time, oldest first unless order is desc. Pagination is cursor-based: while hasMore is true, call again with the same filters and order and pass nextCursor as cursor. No total count is returned.",
        "engagement=opened, bounced and clicked apply to email only. engagement=replied excludes out-of-office email replies. Setting messageType returns LinkedIn messages only.",
        "Messages sent before the sequence_id column was populated can be missing from results.",
      ].join(" "),
      annotations: { readOnlyHint: true },
      inputSchema: z.strictObject({
        workspaceId: z.string().min(1).describe("Workspace ID"),
        sequenceIds: z.array(z.number().int().positive()).min(1).max(10)
          .refine((ids) => new Set(ids).size === ids.length, "sequenceIds must be unique")
          .describe("Numeric multichannel sequence IDs, 1-10 unique values"),
        fromDate: z.iso.date().describe("Start date, inclusive (YYYY-MM-DD)"),
        toDate: z.iso.date().describe("End date, inclusive (YYYY-MM-DD). The window from fromDate to toDate can span at most 30 days; a single day is valid"),
        timezone: z.string().min(1).optional().describe("IANA time zone name, for example America/New_York, used to turn the dates into midnight-to-midnight bounds (default UTC)"),
        channel: z.enum(["email", "linkedin"]).optional().describe("Only this channel (default: both)"),
        engagement: z.enum(["replied", "opened", "bounced", "clicked"]).optional().describe("Only messages with this engagement. opened, bounced and clicked apply to email only"),
        leadIds: z.array(z.string().min(1)).min(1).max(50)
          .refine((ids) => new Set(ids).size === ids.length, "leadIds must be unique")
          .optional().describe("Only messages sent to these contacts, 1-50 unique IDs"),
        messageType: z.enum(["message", "inmail", "connection_note"]).optional().describe("Only this kind of LinkedIn message. Emails are not returned when set"),
        leadStatus: z.enum(leadStatuses).optional().describe("Only leads with this status in the sequence"),
        senderProfileId: z.number().int().positive().optional().describe("Only messages sent from this sender profile"),
        order: z.enum(["asc", "desc"]).optional().describe("Sort by send time: asc is oldest first (default), desc is newest first"),
        cursor: z.string().min(1).optional().describe("nextCursor from the previous response. Valid only in the same workspace and with the same filters and order. Omit for the first page"),
        limit: z.number().int().min(1).max(100).optional().describe("Messages per page (default 50, maximum 100)"),
      }).superRefine(({ fromDate, toDate }, ctx) => {
        if (fromDate > toDate) {
          ctx.addIssue({ code: "custom", message: "toDate must be on or after fromDate", path: ["toDate"] });
        } else if (windowDays(fromDate, toDate) > MAX_WINDOW_DAYS) {
          ctx.addIssue({ code: "custom", message: `The window from fromDate to toDate can span at most ${MAX_WINDOW_DAYS} days`, path: ["toDate"] });
        }
      }),
    },
    ({ workspaceId, sequenceIds, fromDate, toDate, leadIds, messageType, leadStatus, senderProfileId, ...rest }) =>
      handleTool(() => client.mcGet(
        `/multichannel/workspaces/${enc(workspaceId)}/analytics/messages`,
        buildQuery({
          ...rest,
          sequence_ids: sequenceIds.map(String),
          from_date: fromDate,
          to_date: toDate,
          lead_ids: leadIds,
          message_type: messageType,
          lead_status: leadStatus,
          sender_profile_id: senderProfileId,
        }),
      )),
  );
}
