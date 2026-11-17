import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient, type QueryParams } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

/** Register paginated contact tag and mailbox tag discovery. */
export function registerTagTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool("list_tags", {
    description: "List contact tags in a workspace with IDs and names, pagination, and optional name search. These tags are on contacts only. For mailbox tags use list_mailbox_tags.",
    inputSchema: {
      workspaceId: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional().describe("Page size, default 10"),
      offset: z.number().int().nonnegative().optional(),
      search: z.string().max(255).optional(),
      caseSensitive: z.boolean().optional().describe("Case-sensitive search, default false"),
    },
  }, ({ workspaceId, caseSensitive, ...options }) =>
    handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/tags`, buildQuery({
      ...options,
      caseSensitive: caseSensitive === undefined ? undefined : String(caseSensitive),
    }))));

  server.registerTool("list_mailbox_tags", {
    description: "List mailbox tags in a workspace with IDs, names and mailboxCount (number of mailboxes with the tag). Use it to turn a tag name into a tag ID for list_mailboxes tagIds or for mailboxFilter.tagIds on the sender-profile tools. Contact tags are listed by list_tags.",
    inputSchema: {
      workspaceId: z.string().min(1),
      name: z.string().min(1).max(255).optional().describe("Exact tag name, case-insensitive"),
      nameContains: z.string().min(1).max(255).optional().describe("Tags whose name contains this text, case-insensitive"),
      ids: z.array(z.string().min(1)).max(100).optional().describe("Only tags with these IDs, up to 100"),
      mailboxIds: z.array(z.string().min(1)).max(1000).optional().describe("Only tags attached to at least one of these mailboxes, up to 1000"),
      limit: z.number().int().min(1).max(100).optional().describe("Page size, 1-100"),
      offset: z.number().int().nonnegative().optional(),
    },
  }, ({ workspaceId, ids, mailboxIds, ...options }) => {
    const query: QueryParams = buildQuery(options);
    if (ids?.length) query["ids[]"] = ids;
    if (mailboxIds?.length) query["mailbox_ids[]"] = mailboxIds;
    return handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/mailbox-tags`, query));
  });
}
