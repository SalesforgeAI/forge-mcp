import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

const validationStatusesSchema = z.enum([
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
]);

export const validationFiltersSchema = z
  .object({
    esps: z.array(z.string()).optional().describe("Email service providers to include."),
    notInESPs: z.array(z.string()).optional().describe("Email service providers to exclude."),
    validationStatuses: z.array(validationStatusesSchema).optional().describe("Email validation statuses to include."),
    tagIds: z.array(z.string()).optional().describe("Tag IDs to include."),
    leadIds: z.array(z.string()).optional().describe("Contact IDs to include."),
    customVars: z.array(z.string()).optional().describe("Custom variable values to include."),
    notInCustomVars: z.array(z.string()).optional().describe("Custom variable values to exclude."),
    notInLeadIds: z.array(z.string()).optional().describe("Contact IDs to exclude."),
    customVarIds: z.array(z.string()).optional().describe("Custom variable IDs to include."),
    notInCustomVarIds: z.array(z.string()).optional().describe("Custom variable IDs to exclude."),
    notInTagIds: z.array(z.string()).optional().describe("Tag IDs to exclude."),
    searchQuery: z.string().optional().describe("Contact search query."),
    selectionScope: z
      .enum(["all", "not_in_sequence", "in_sequence"])
      .optional()
      .describe("Workspace-wide sequence membership filter."),
    excludeContacted: z.boolean().optional().describe("Whether to exclude contacts that have already been contacted."),
    numberOfContactsToAdd: z.number().int().positive().optional().describe("Maximum contacts to select before applying limit."),
    deleted: z.boolean().optional().describe("Whether to include deleted contacts."),
    hasValidLinkedIn: z.boolean().optional().describe("Whether to require a valid LinkedIn URL."),
    withEmailOnly: z.boolean().optional().describe("Whether to require contacts with an email address."),
    hasEmail: z.boolean().optional().describe("Whether to require an email address."),
  })
  .strict()
  .refine(filters => Object.keys(filters).length > 0, "At least one validation filter is required.");

export function registerValidationTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "start_email_validation",
    {
      description:
        "Starts an asynchronous email validation run for workspace contacts. Candidate membership is resolved and persisted before the 201 response. selected is exact, and skipped.duplicate is exact, supported counts. A non-empty selection returns pending; an empty selection returns failed with failureCode validation_scope_empty. The legacy strict option is omitted and deprecated. HTTP 402 means validation credits are unavailable. Retain the validationJobID and poll get_validation_results; its result is authoritative for validation outcomes, and failed runs must not be automatically resubmitted.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        filters: validationFiltersSchema.describe("Non-empty filters to select contacts for validation."),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Maximum contacts to validate. When numberOfContactsToAdd is also set in filters, Multichannel uses the smaller value.",
          ),
      },
    },
    ({ workspaceId, filters, limit }) =>
      handleTool(() =>
        client.mcPost(`/multichannel/workspaces/${enc(workspaceId)}/validations`, {
          filters,
          limit,
        }),
      ),
  );

  server.registerTool(
    "get_validation_results",
    {
      description:
        "Polls an asynchronous validation run by validationJobID. Nonterminal runs report pending or in_progress; terminal runs report completed, partially_completed, or failed. Terminal counts are authoritative, failureCode is stable, and failed runs must not be automatically resubmitted. When enrolling from the run, omitted or empty validationStatuses means no status restriction and considers all run candidates, including unvalidated contacts; non-empty statuses are evaluated from the run's persisted results. Legacy completed runs instead evaluate non-empty statuses against current Salesforge status.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        runId: z.string().describe("Validation run ID"),
      },
    },
    ({ workspaceId, runId }) =>
      handleTool(() =>
        client.mcGet(`/multichannel/workspaces/${enc(workspaceId)}/validations/${enc(runId)}/results`),
      ),
  );
}
