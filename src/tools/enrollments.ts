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
    .describe("Explicit contact IDs; intersected with validationRunId contacts when both are provided"),
  tagIds: z.array(z.string()).optional().describe("Tag IDs to filter contacts"),
  esps: z.array(z.string()).optional().describe("Email service providers to filter contacts"),
  validationRunId: z.string().optional().describe("Select contacts included in this validation run"),
  validationStatuses: z
    .array(z.string())
    .optional()
    .describe(
      "Email validation statuses: safe, invalid, disabled, disposable, inbox_full, catch_all, role_account, spamtrap, unknown, unvalidated, or linkedin_only",
    ),
  hasEmail: z.boolean().optional().describe("When true, select only contacts that have an email address"),
  hasValidLinkedIn: z.boolean().optional().describe("When true, select only contacts with a valid LinkedIn URL"),
});

const confirmEnrollmentPreflightSchema = z
  .object({
    workspaceId: z.string().describe("Workspace ID"),
    sequenceId: z.string().describe("Target sequence ID"),
    preflightId: z.string().describe("Preflight ID returned by preflight_enrollments"),
    action: z
      .enum(["skip", "move"])
      .describe("skip ignores all contacts requiring a decision; move resolves covered source conflicts"),
    moveSourceSequenceIds: z
      .array(z.number().int().positive())
      .optional()
      .describe(
        "Used only for action=move; a contact is skipped unless every source sequence requiring cleanup for that contact is selected",
      ),
    skipReplied: z
      .boolean()
      .optional()
      .describe(
        "Required for action=move: true leaves previously replied contacts unenrolled; false explicitly allows their enrollment. Omit for action=skip.",
      ),
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
        "DEPRECATED: Use preflight_enrollments followed by confirm_enrollment_preflight. This legacy tool immediately enrolls matching contacts without exposing the preflight conflict and replied-contact decisions.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        filters: enrollmentFiltersSchema.describe("Filters to select contacts for enrollment"),
        limit: z.number().optional().describe("Max contacts to enroll (default 500)"),
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
        "Create a non-mutating, 15-minute enrollment preflight for matching contacts. Returns a preflightId and expiresAt, decision counts, source-sequence move groups, and the replied-contact count. No contacts are enrolled until confirm_enrollment_preflight applies a skip or move decision.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Target sequence ID"),
        filters: enrollmentFiltersSchema
          .optional()
          .describe("Contact filters; provide at least one effective filter or a positive limit"),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum candidates after filters and selection scope; may be used without filters"),
        selectionScope: z
          .enum(["all", "not_in_sequence", "in_sequence"])
          .optional()
          .describe(
            "Sequence-membership scope: all (default), not_in_sequence (not enrolled in any sequence), or in_sequence (enrolled in at least one sequence); this does not replace the required filter or limit",
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
        "Recalculate move-mode counts for a saved preflight without changing enrollments. Returns moveModeEnrollCount, moveCleanupContactCount, repliedSkippedCount, and skippedByUncheckedGroupCount. skipReplied must be an explicit choice so the preview matches confirmation. A stale preflight returns 409 preflight_stale with a replacement preflight in the error data; use that replacement instead of retrying the old preflight.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Target sequence ID"),
        preflightId: z.string().describe("Preflight ID returned by preflight_enrollments"),
        moveSourceSequenceIds: z
          .array(z.number().int().positive())
          .optional()
          .describe(
            "Source sequences selected for cleanup; a contact is skipped unless every source sequence requiring cleanup for that contact is selected",
          ),
        skipReplied: z
          .boolean()
          .describe(
            "Required explicit choice: true excludes contacts with a previous reply; false includes eligible replied contacts",
          ),
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
        "Apply a saved enrollment preflight if its enrollment state is still current. skip enrolls only candidates that require no conflict decision and performs no source cleanup. move requires an explicit skipReplied choice, enrolls eligible candidates whose cleanup conflicts are covered by moveSourceSequenceIds, and cleans those source enrollments. Headroom is rechecked while confirmations are serialized per account, and cleanup from paused source sequences does not create active-enrollment headroom. Returns enrolled lead IDs and enrolled, skipped, moved, and already-in-target counts. A stale preflight returns 409 preflight_stale with a replacement preflight in the error data; continue with the replacement, not the old ID. A concurrent confirmation returns 423 enrollment_confirmation_busy; retry the same confirmation after the in-progress request finishes. An expired preflight returns 404 and requires a new preflight.",
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
      description: "Remove contacts from a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        filters: z
          .object({
            leadIds: z.array(z.string()).optional().describe("Lead/contact IDs to remove"),
            tagIds: z.array(z.string()).optional().describe("Tag IDs to filter"),
          })
          .describe("Filters to select contacts for removal"),
      },
    },
    ({ workspaceId, sequenceId, filters }) =>
      handleTool(() => client.mcPost(`${enrollPath(workspaceId, sequenceId)}/remove`, { filters })),
  );
}
