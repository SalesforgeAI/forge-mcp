import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient, type QueryParams } from "../client.js";
import { handleTool, enc } from "../helpers.js";

const VALIDATION_STATUSES = [
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
] as const;

export function registerContactTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_contacts",
    {
      description: "List contacts in a workspace with optional filters (tags, validation statuses, ESPs, pagination)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results per page (default 10)"),
        offset: z.number().optional().describe("Offset for pagination"),
        tagIds: z.array(z.string()).optional().describe("Tag IDs to filter by"),
        validationStatuses: z
          .array(z.enum(VALIDATION_STATUSES))
          .optional()
          .describe("Validation statuses to filter by"),
        notInSequenceId: z.string().optional().describe("Filter to contacts not enrolled in this sequence ID"),
        hasValidLinkedIn: z.boolean().optional().describe("Filter to contacts that have a valid LinkedIn URL"),
        notInEsps: z.array(z.string()).optional().describe("Exclude contacts whose email domain belongs to these ESPs"),
      },
    },
    ({ workspaceId, limit, offset, tagIds, validationStatuses, notInSequenceId, hasValidLinkedIn, notInEsps }) => {
      const query: QueryParams = {};
      if (limit !== undefined) query.limit = String(limit);
      if (offset !== undefined) query.offset = String(offset);
      if (notInSequenceId !== undefined) query.not_in_sequence_id = notInSequenceId;
      if (hasValidLinkedIn !== undefined) query.has_valid_linkedin = String(hasValidLinkedIn);
      if (tagIds && tagIds.length) query["tag_ids[]"] = tagIds;
      if (validationStatuses && validationStatuses.length) query["validation_statuses[]"] = validationStatuses;
      if (notInEsps && notInEsps.length) query["not_in_esps[]"] = notInEsps;
      return handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/contacts`, query));
    },
  );

  server.registerTool(
    "create_contact",
    {
      description: "Create a single contact in a workspace",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        firstName: z.string().describe("First name (required)"),
        lastName: z.string().optional().describe("Last name"),
        email: z.string().optional().describe("Email address"),
        company: z.string().optional().describe("Company name"),
        position: z.string().optional().describe("Job title/position"),
        linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
        tags: z.array(z.string()).optional().describe("Tag names to assign"),
        tagIds: z.array(z.string()).optional().describe("Tag IDs to assign"),
        customVars: z.record(z.string(), z.string()).optional().describe("Custom variables as key-value pairs"),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts`, body)),
  );

  server.registerTool(
    "bulk_create_contacts",
    {
      description: "Create up to 100 contacts in a workspace at once",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contacts: z.array(
          z.object({
            firstName: z.string().describe("First name (required)"),
            lastName: z.string().optional(),
            email: z.string().optional(),
            company: z.string().optional(),
            position: z.string().optional(),
            linkedinUrl: z.string().optional(),
            tags: z.array(z.string()).optional(),
            tagIds: z.array(z.string()).optional(),
            customVars: z.record(z.string(), z.string()).optional(),
          }),
        ).describe("Array of contacts (1-100)"),
      },
    },
    ({ workspaceId, contacts }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts/bulk`, { contacts })),
  );

  server.registerTool(
    "get_contact",
    {
      description: "Get a contact by ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contactId: z.string().describe("Contact ID"),
      },
    },
    ({ workspaceId, contactId }) =>
      handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/contacts/${enc(contactId)}`)),
  );
}
