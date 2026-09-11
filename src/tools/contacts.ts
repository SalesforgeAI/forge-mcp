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

const contactFilters = z.object({
  workspaceId: z.string().describe("Workspace ID"),
  tagIds: z.array(z.string()).optional().describe("Tag IDs to filter by"),
  validationStatuses: z
    .array(z.enum(VALIDATION_STATUSES))
    .optional()
    .describe("Validation statuses to filter by"),
  notInSequenceId: z.string().optional().describe("Filter to contacts not enrolled in this sequence ID"),
  hasValidLinkedIn: z.boolean().optional().describe("Filter to contacts that have a valid LinkedIn URL"),
  notInEsps: z.array(z.string()).optional().describe("Exclude contacts whose email domain belongs to these ESPs"),
});

/** Serialize the shared contact filters for listing and exact counting. */
function contactFilterQuery(filters: z.infer<typeof contactFilters>): QueryParams {
  const query: QueryParams = {};
  if (filters.notInSequenceId !== undefined) query.not_in_sequence_id = filters.notInSequenceId;
  if (filters.hasValidLinkedIn !== undefined) query.has_valid_linkedin = String(filters.hasValidLinkedIn);
  if (filters.tagIds?.length) query["tag_ids[]"] = filters.tagIds;
  if (filters.validationStatuses?.length) query["validation_statuses[]"] = filters.validationStatuses;
  if (filters.notInEsps?.length) query["not_in_esps[]"] = filters.notInEsps;
  return query;
}

export function registerContactTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_contacts",
    {
      description: "List contacts in a workspace using cursor pagination. Omit cursor for the first page; pass nextCursor from the response with the same workspace and filters for the next page. Stop when hasMore is false (nextCursor is absent). Responses contain data, limit, hasMore and nextCursor, without a total count. Use count_contacts only when a total is needed.",
      inputSchema: {
        ...contactFilters.shape,
        limit: z.number().int().min(1).max(1000).optional().describe("Max results per page (1-1000, default 10)"),
        cursor: z.string().min(1).optional().describe("Opaque nextCursor from the previous response; omit for the first page"),
      },
    },
    ({ limit, cursor, ...filters }) => {
      const query: QueryParams = { ...contactFilterQuery(filters), pagination: "cursor" };
      if (limit !== undefined) query.limit = String(limit);
      if (cursor !== undefined) query.cursor = cursor;
      return handleTool(() => client.coreGet(`/workspaces/${enc(filters.workspaceId)}/contacts`, query));
    },
  );

  server.registerTool(
    "count_contacts",
    {
      description: "Get the exact total number of active contacts matching the same filters as list_contacts. Returns { total }. Call only when a total is needed; counts can be expensive and are not required for cursor pagination. Does not accept cursor, limit or offset.",
      inputSchema: contactFilters.shape,
    },
    (filters) => handleTool(() => client.coreGet(
      `/workspaces/${enc(filters.workspaceId)}/contacts/count`, contactFilterQuery(filters),
    )),
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
