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
  excludeContacted: z.boolean().optional().describe("Whether to exclude previously contacted contacts."),
  hasEmail: z.boolean().optional().describe("Whether to include only contacts with an email address."),
  hasValidLinkedIn: z.boolean().optional().describe("Whether to include only contacts with a valid LinkedIn URL."),
});

const confirmEnrollmentPreflightSchema = z
  .object({
    workspaceId: z.string().describe("Workspace ID."),
    sequenceId: z.string().describe("Target sequence ID."),
    preflightId: z.string().describe("Enrollment preflight ID."),
    action: z
      .enum(["skip", "move"])
      .describe("Conflict resolution action. skip excludes conflicts; move resolves selected source conflicts."),
    moveSourceSequenceIds: z
      .array(z.number().int().positive())
      .optional()
      .describe(
        "Source sequence IDs to clean up for a move action. A contact is skipped unless all of its required sources are selected.",
      ),
    skipReplied: z
      .boolean()
      .optional()
      .describe(
        "Whether to skip contacts that previously replied. Required for move actions and omitted for skip actions.",
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
        "Analyzes matching contacts before enrollment and creates a preflight that expires after 15 minutes. Returns candidate totals, conflicts, available source cleanup groups, and replied-contact information. Use confirm_enrollment_preflight to apply a skip or move decision.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe("Target sequence ID."),
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
          .describe("Sequence membership scope. Defaults to all."),
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
        "Calculates the projected outcome of a move decision without changing enrollments. Returns projected enrollment, skip, and source cleanup counts with a skip-reason breakdown. A stale preflight error includes a replacement preflight.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID."),
        sequenceId: z.string().describe("Target sequence ID."),
        preflightId: z.string().describe("Enrollment preflight ID."),
        moveSourceSequenceIds: z
          .array(z.number().int().positive())
          .optional()
          .describe(
            "Source sequence IDs to clean up. A contact is skipped unless all of its required sources are selected.",
          ),
        skipReplied: z
          .boolean()
          .describe("Whether to skip contacts that previously replied."),
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
        "Applies a skip or move decision to an enrollment preflight. Returns enrolled contact IDs and actual enrollment, skip, source cleanup, and already-in-target counts. Stale preflights include a replacement; expired preflights require a new preflight.",
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
