import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

function enrollPath(workspaceId: string, sequenceId: string) {
  return `/multichannel/workspaces/${enc(workspaceId)}/sequences/${enc(sequenceId)}/enrollments`;
}

const enrollmentFiltersSchema = z.object({
  leadIds: z
    .array(z.string())
    .optional()
    .describe("Contact IDs to include. Intersected with validationRunId when both are provided."),
  notInLeadIds: z.array(z.string()).optional().describe("Contact IDs to exclude."),
  tagIds: z.array(z.string()).optional().describe("Tag IDs to include."),
  notInTagIds: z.array(z.string()).optional().describe("Tag IDs to exclude."),
  esps: z.array(z.string()).optional().describe("Email service providers to include."),
  notInESPs: z.array(z.string()).optional().describe("Email service providers to exclude."),
  customVars: z.array(z.string()).optional().describe("Custom variable values to include."),
  notInCustomVars: z.array(z.string()).optional().describe("Custom variable values to exclude."),
  customVarIds: z.array(z.string()).optional().describe("Custom variable IDs to include."),
  notInCustomVarIds: z.array(z.string()).optional().describe("Custom variable IDs to exclude."),
  searchQuery: z.string().optional().describe("Contact search query."),
  validationRunId: z
    .string()
    .optional()
    .describe("Completed validation run ID. The run must contain at least one contact."),
  validationStatuses: z
    .array(
      z.enum([
        "safe",
        "invalid",
        "disabled",
        "disposable",
        "inbox_full",
        "catch_all",
        "role_account",
        "spamtrap",
        "unknown",
        "unvalidated",
        "linkedin_only",
      ]),
    )
    .optional()
    .describe("Email validation statuses to include."),
  excludeContacted: z.boolean().optional().describe("Whether to exclude contacts that have already been contacted."),
  hasEmail: z.boolean().optional().describe("Whether to require an email address."),
  hasValidLinkedIn: z.boolean().optional().describe("Whether to require a valid LinkedIn URL."),
});

const targetSequenceIdDescription =
  "Sequence to enroll contacts into. Its status is not returned: enrollment into a draft sequence can succeed, but outreach starts only after the sequence is launched.";

const moveSourceSequenceIdsDescription =
  "Sequence IDs to move contacts from. If a contact has several required source sequences, include all of them; otherwise the contact is skipped entirely and no partial move occurs.";

const skipRepliedDescription =
  "Whether to exclude contacts that replied in another sequence. Required for move decisions: true skips them; false allows them when all required source sequences are selected.";

const confirmEnrollmentPreflightSchema = z
  .object({
    workspaceId: z.string().describe("Workspace ID."),
    sequenceId: z.string().describe(targetSequenceIdDescription),
    preflightId: z.string().describe("Enrollment preflight ID."),
    action: z
      .enum(["skip", "move"])
      .describe(
        "Enrollment action. skip enrolls only contacts that need no decision; move enrolls eligible contacts and updates their enrollment in the selected source sequences.",
      ),
    moveSourceSequenceIds: z
      .array(z.number().int().positive())
      .optional()
      .describe(moveSourceSequenceIdsDescription),
    skipReplied: z.boolean().optional().describe(skipRepliedDescription),
  })
  .superRefine(({ action, skipReplied }, ctx) => {
    if (action === "move" && skipReplied === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["skipReplied"],
        message: "skipReplied is required when action is move",
      });
    }
  });

export function registerEnrollmentTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "enroll_contacts",
    {
      title: "Enroll Contacts (Deprecated)",
      description:
        "Deprecated. Enrolls matching contacts immediately without conflict review. Use preflight_enrollments and confirm_enrollment_preflight for new integrations.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe("Sequence ID."),
        filters: enrollmentFiltersSchema.describe("Contact filters."),
        limit: z.number().int().positive().optional().describe("Maximum number of contacts to enroll."),
      },
    },
    ({ workspaceId, sequenceId, filters, limit }) => {
      const payload: Record<string, unknown> = { filters };
      if (limit !== undefined) payload.limit = limit;
      return handleTool(() => client.mcPost(enrollPath(workspaceId, sequenceId), payload));
    },
  );

  server.registerTool(
    "preflight_enrollments",
    {
      description:
        "Checks matching contacts before enrollment and saves a preflight for 15 minutes. Returns enrollment counts, sequences contacts can be moved from, and replied-contact information. A contact can appear in several moveGroups, so do not sum selectedContactCount across groups. Counts can include do-not-contact, unsubscribed, or bounce-shielded contacts: they are enrolled but receive no outreach. Use confirm_enrollment_preflight to apply a skip or move decision.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe(targetSequenceIdDescription),
        filters: enrollmentFiltersSchema
          .optional()
          .describe("Contact filters. At least one filter or a limit is required."),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of candidates after filtering and selection scope."),
        selectionScope: z
          .enum(["all", "not_in_sequence", "in_sequence"])
          .optional()
          .describe(
            "Workspace-wide sequence membership filter, not membership relative to the target sequence. all includes every matching contact; not_in_sequence includes contacts enrolled in no sequence in the workspace; in_sequence includes contacts enrolled in at least one sequence in the workspace. Defaults to all.",
          ),
      },
    },
    ({ workspaceId, sequenceId, filters, limit, selectionScope }) => {
      const payload: Record<string, unknown> = {};
      if (filters !== undefined) payload.filters = filters;
      if (limit !== undefined) payload.limit = limit;
      if (selectionScope !== undefined) payload.selectionScope = selectionScope;
      return handleTool(() => client.mcPost(`${enrollPath(workspaceId, sequenceId)}/preflight`, payload));
    },
  );

  server.registerTool(
    "preview_enrollment_move",
    {
      description:
        "Calculates the expected result of a move decision without changing enrollments. Returns expected enrollment, skip, and source-update counts with skip reasons. Omitting any required source sequence skips the entire contact; no partial move occurs. enrolledCount can include do-not-contact, unsubscribed, or bounce-shielded contacts; they receive no outreach. A stale preflight error includes a replacement preflight.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe(targetSequenceIdDescription),
        preflightId: z.string().describe("Enrollment preflight ID."),
        moveSourceSequenceIds: z
          .array(z.number().int().positive())
          .optional()
          .describe(moveSourceSequenceIdsDescription),
        skipReplied: z.boolean().describe(skipRepliedDescription),
      },
    },
    ({ workspaceId, sequenceId, preflightId, moveSourceSequenceIds, skipReplied }) =>
      handleTool(() =>
        client.mcPost(`${enrollPath(workspaceId, sequenceId)}/preflight/${enc(preflightId)}/move-preview`, {
          moveSourceSequenceIds,
          skipReplied,
        }),
      ),
  );

  server.registerTool(
    "confirm_enrollment_preflight",
    {
      description:
        "Applies a skip or move decision to an enrollment preflight. A move is all-or-nothing per contact: omitting any required source sequence skips that contact. Returns enrolled contact IDs and actual enrollment, skip, source-update, and already-in-target counts. enrolledCount can include do-not-contact, unsubscribed, or bounce-shielded contacts; they receive no outreach. Stale preflights include a replacement; expired preflights require a new preflight.",
      inputSchema: confirmEnrollmentPreflightSchema,
    },
    ({ workspaceId, sequenceId, preflightId, action, moveSourceSequenceIds, skipReplied }) =>
      handleTool(() =>
        client.mcPost(`${enrollPath(workspaceId, sequenceId)}/preflight/${enc(preflightId)}/confirm`, {
          action,
          moveSourceSequenceIds,
          skipReplied,
        }),
      ),
  );

  server.registerTool(
    "remove_enrollments",
    {
      description: "Removes matching contacts from a multichannel sequence. Enrollment preflight is not required.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe("Sequence ID."),
        filters: enrollmentFiltersSchema.describe("Contact filters."),
        limit: z.number().int().positive().optional().describe("Maximum number of contacts to remove."),
      },
    },
    ({ workspaceId, sequenceId, filters, limit }) => {
      const payload: Record<string, unknown> = { filters };
      if (limit !== undefined) payload.limit = limit;
      return handleTool(() => client.mcPost(`${enrollPath(workspaceId, sequenceId)}/remove`, payload));
    },
  );
}
