import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

const sequenceLeadSequenceId = z.string().regex(/^[0-9]+$/)
  .refine((value) => Number(value) >= 1 && Number(value) <= 2147483647, "Sequence ID must be between 1 and 2147483647")
  .describe("Numeric multichannel sequence ID as a string; legacy seq_ IDs are not supported");

function seqPath(workspaceId: string, sequenceId?: string) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/sequences`;
  return sequenceId ? `${base}/${enc(sequenceId)}` : base;
}

export function registerSequenceTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sequences",
    {
      description: "List multichannel sequences (email + LinkedIn) in a workspace. These have numeric IDs. For legacy email-only sequences (IDs prefixed with seq_), use the core API.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ workspaceId, limit, offset }) =>
      handleTool(() => client.mcGet(seqPath(workspaceId), buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "list_sequence_leads",
    {
      description: [
        "List leads enrolled in a multichannel sequence. Each entry contains contact details in lead, current sequence enrollment state in enrollment, and timeline steps in execution order.",
        "Each step includes available message content, replyContent, sender, delivery, engagement, and error details. Optional fields are omitted when unavailable or inapplicable. Sender identifies the profile and mailbox assigned to the step, with current profile details.",
        "replyContent is the earliest stored reply associated with the step, regardless of current enrollment status. Replies are matched by task; unlinked replies are matched to the latest preceding execution on the same channel. It represents one reply, not the full conversation.",
        "executionStatus describes step processing. scheduledAt is the planned execution time, subject to sequence and sender availability; blockedByLeadStatus identifies an enrollment status preventing a pending or scheduled step from running.",
        "delivery applies to email, LinkedIn messages, and InMail. Its status is unknown, sent, or email-only bounced. Sent records a send without confirming receipt or reading. LinkedIn sends require a message associated with the step and omit sentAt. Email engagement counts are recorded events; zero counts do not establish tracking availability.",
        "Pagination applies to leads, including when filtering by leadIds. Each lead includes its available timeline without separate pagination.",
      ].join(" "),
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        workspaceId: z.string().min(1).describe("Workspace ID"),
        sequenceId: sequenceLeadSequenceId,
        page: z.number().int().positive().optional().describe("Page number (default 1)"),
        limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20, maximum 100)"),
        status: z.string().optional().describe("Filter by sequence enrollment status"),
        q: z.string().optional().describe("Search lead name or email"),
        openedEmailsOnly: z.boolean().optional().describe("Only leads with recorded email opens"),
        inSubsequence: z.boolean().optional().describe("Only leads moved to a subsequence"),
        leadIds: z.array(z.string().min(1).regex(/^[^,]+$/)).min(1).optional().describe("Filter by lead IDs; use a single ID to look up one lead"),
        sortBy: z.enum(["recently_contacted", "least_recently_contacted", "recently_updated", "recently_added", "oldest_added"]).default("recently_updated").describe("Sort by enrollment update time (recently_updated), enrollment creation time (recently_added/oldest_added), or contact activity (recently_contacted/least_recently_contacted). Also selects the timestamp used by from and to. Defaults to recently_updated"),
        sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort direction; defaults to desc. least_recently_contacted and oldest_added always use asc"),
        from: z.iso.date().optional().describe("Inclusive UTC start date (YYYY-MM-DD); requires to"),
        to: z.iso.date().optional().describe("Inclusive UTC end date (YYYY-MM-DD); requires from"),
      }).superRefine(({ from, to }, ctx) => {
        if ((from === undefined) !== (to === undefined)) {
          ctx.addIssue({ code: "custom", message: "Provide both from and to dates", path: [from === undefined ? "from" : "to"] });
        } else if (from !== undefined && to !== undefined && from > to) {
          ctx.addIssue({ code: "custom", message: "to must be on or after from", path: ["to"] });
        }
      }),
    },
    ({ workspaceId, sequenceId, openedEmailsOnly, inSubsequence, leadIds, ...query }) =>
      handleTool(() => client.mcGet(`${seqPath(workspaceId, sequenceId)}/leads`, buildQuery({
        ...query,
        openedEmailsOnly: openedEmailsOnly === undefined ? undefined : String(openedEmailsOnly),
        in_subsequence: inSubsequence === undefined ? undefined : String(inSubsequence),
        leadIds: leadIds?.join(","),
      }))),
  );

  server.registerTool(
    "create_sequence",
    {
      description: "Create a new multichannel sequence (supports email + LinkedIn channels)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        name: z.string().describe("Sequence name"),
        description: z.string().optional().describe("Sequence description"),
        timezone: z.string().optional().describe("IANA timezone (e.g. America/New_York)"),
        kind: z.enum(["primary", "subsequence"]).optional().describe("Sequence kind (default primary). Use subsequence for follow-up flows triggered by Primebox labels."),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.mcPost(seqPath(workspaceId), body)),
  );

  server.registerTool(
    "get_sequence",
    {
      description: "Get multichannel sequence details by numeric ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(seqPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "update_sequence",
    {
      description: "Update a multichannel sequence (name, description, timezone)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
        timezone: z.string().optional().describe("New IANA timezone"),
      },
    },
    ({ workspaceId, sequenceId, ...body }) =>
      handleTool(() => client.mcPatch(seqPath(workspaceId, sequenceId), body)),
  );

  server.registerTool(
    "delete_sequence",
    {
      description: "Delete a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcDelete(seqPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "launch_sequence",
    {
      description: "Activate/launch a multichannel sequence (must have nodes and sender profiles configured)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/launch`, {})),
  );

  server.registerTool(
    "set_sequence_status",
    {
      description: "Pause or activate a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        status: z.enum(["active", "paused"]).describe("New status"),
      },
    },
    ({ workspaceId, sequenceId, status }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/status`, { status })),
  );

  server.registerTool(
    "get_sequence_schedule",
    {
      description: "Get the sending schedule for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(`${seqPath(workspaceId, sequenceId)}/schedule`)),
  );

  server.registerTool(
    "update_sequence_schedule",
    {
      description: "Update the sending schedule for a multichannel sequence. Each day has enabled (boolean), from (hour 0-23), and to (hour 0-23).",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        timezone: z.string().describe("IANA timezone string (e.g. 'America/New_York', 'Asia/Kolkata')"),
        schedule: z.object({
          monday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          tuesday:   z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          wednesday: z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          thursday:  z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          friday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          saturday:  z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          sunday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
        }).describe("Schedule per day of week"),
      },
    },
    ({ workspaceId, sequenceId, timezone, schedule }) =>
      handleTool(() => client.mcPut(`${seqPath(workspaceId, sequenceId)}/schedule`, { timezone, schedule })),
  );

  server.registerTool(
    "get_sequence_settings",
    {
      description: "Get settings for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(`${seqPath(workspaceId, sequenceId)}/settings`)),
  );

  server.registerTool(
    "update_sequence_settings",
    {
      description: "Update settings for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        settings: z.record(z.string(), z.any()).describe("Settings object"),
      },
    },
    ({ workspaceId, sequenceId, settings }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/settings`, settings)),
  );
}
