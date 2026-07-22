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

  const contactFields = {
    firstName: z.string().describe("First name (required)"),
    lastName: z.string().optional().describe("Last name"),
    email: z.string().optional().describe("Email address (also used to match an existing contact)"),
    company: z.string().optional().describe("Company name"),
    position: z.string().optional().describe("Job title/position"),
    linkedinUrl: z
      .string()
      .optional()
      .describe("LinkedIn profile URL (also used to match an existing contact)"),
    tags: z.array(z.string()).optional().describe("Tag names to assign"),
    tagIds: z.array(z.string()).optional().describe("Tag IDs to assign"),
    customVars: z
      .record(z.string(), z.string())
      .optional()
      .describe("Custom variables as key-value pairs (non-empty keys and values)"),
  };

  server.registerTool(
    "create_contact",
    {
      description:
        "Create a contact in a workspace. If a contact with the same email or LinkedIn URL already exists, it is updated (including customVars).",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        ...contactFields,
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts`, body)),
  );

  server.registerTool(
    "update_contact",
    {
      description:
        "Update a contact matched by email or LinkedIn URL (upsert). Use customVars to set or overwrite custom variables as key-value pairs, same shape as create_contact.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        ...contactFields,
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts`, body)),
  );

  server.registerTool(
    "bulk_create_contacts",
    {
      description:
        "Create up to 100 contacts in a workspace at once. Existing contacts matched by email or LinkedIn URL are updated (including customVars).",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contacts: z.array(z.object(contactFields)).describe("Array of contacts (1-100)"),
      },
    },
    ({ workspaceId, contacts }) =>
      handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/contacts/bulk`, { contacts })),
  );

  server.registerTool(
    "bulk_update_contacts",
    {
      description:
        "Update up to 100 contacts at once (upsert by email or LinkedIn URL). Each contact can include customVars as key-value pairs, same shape as bulk_create_contacts.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        contacts: z.array(z.object(contactFields)).describe("Array of contacts (1-100)"),
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
