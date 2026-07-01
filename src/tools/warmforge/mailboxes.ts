import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { optionalWorkspaceIdSchema, resolveWarmforgePath } from "./workspaces.js";

export function registerWarmforgeMailboxTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "warmforge_list_mailboxes",
    {
      description: "List Warmforge mailboxes (paginated). Status: warm, pending, disconnected, suspended, all",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        page: z.number().describe("Page number (starts at 1)"),
        page_size: z.number().describe("Results per page (1-100)"),
        search: z.string().optional().describe("Search filter"),
        status: z.string().optional().describe("Filter by status: warm, pending, disconnected, suspended, all"),
        external_reference: z.string().optional().describe("Filter by external reference"),
      },
    },
    ({ workspaceId, page, page_size, search, status, external_reference }) =>
      handleTool(() =>
        client.get(
          resolveWarmforgePath(workspaceId, "/mailboxes"),
          buildQuery({ page, page_size, search, status, external_reference }),
        ),
      ),
  );

  server.registerTool(
    "warmforge_get_mailbox",
    {
      description: "Get a Warmforge mailbox by email address",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        address: z.string().describe("Email address"),
      },
    },
    ({ workspaceId, address }) =>
      handleTool(() => client.get(resolveWarmforgePath(workspaceId, `/mailboxes/${enc(address)}`))),
  );

  server.registerTool(
    "warmforge_connect_smtp_mailbox",
    {
      description: "Connect an SMTP mailbox to Warmforge",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        body: z
          .record(z.string(), z.any())
          .describe("SMTP connection payload (address, firstName, lastName, smtp/imap config, warmup settings)"),
      },
    },
    ({ workspaceId, body }) =>
      handleTool(() => client.post(resolveWarmforgePath(workspaceId, "/mailboxes/connect-smtp"), body)),
  );

  server.registerTool(
    "warmforge_connect_oauth2_mailbox",
    {
      description: "Connect an OAuth2 mailbox to Warmforge",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        body: z.record(z.string(), z.any()).describe("OAuth2 connection payload"),
      },
    },
    ({ workspaceId, body }) =>
      handleTool(() => client.post(resolveWarmforgePath(workspaceId, "/mailboxes/connect-oauth2"), body)),
  );

  server.registerTool(
    "warmforge_update_mailbox",
    {
      description: "Update a Warmforge mailbox",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        address: z.string().describe("Email address"),
        body: z.record(z.string(), z.any()).describe("Update payload (warmup config, name, etc.)"),
      },
    },
    ({ workspaceId, address, body }) =>
      handleTool(() => client.patch(resolveWarmforgePath(workspaceId, `/mailboxes/${enc(address)}`), body)),
  );

  server.registerTool(
    "warmforge_bulk_update_mailboxes",
    {
      description: "Update multiple Warmforge mailboxes at once",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        body: z.record(z.string(), z.any()).describe("Bulk update payload"),
      },
    },
    ({ workspaceId, body }) =>
      handleTool(() => client.post(resolveWarmforgePath(workspaceId, "/mailboxes/bulk-update"), body)),
  );

  server.registerTool(
    "warmforge_delete_mailbox",
    {
      description: "Delete a Warmforge mailbox",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        address: z.string().describe("Email address"),
      },
    },
    ({ workspaceId, address }) =>
      handleTool(() => client.delete(resolveWarmforgePath(workspaceId, `/mailboxes/${enc(address)}`))),
  );

  server.registerTool(
    "warmforge_get_mailbox_warmup_stats",
    {
      description: "Get warmup statistics for a Warmforge mailbox",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        address: z.string().describe("Email address"),
        from: z.string().describe("Start date (YYYY-MM-DD)"),
        to: z.string().describe("End date (YYYY-MM-DD)"),
      },
    },
    ({ workspaceId, address, from, to }) =>
      handleTool(() =>
        client.get(
          resolveWarmforgePath(workspaceId, `/mailboxes/${enc(address)}/warmup/stats`),
          buildQuery({ from, to }),
        ),
      ),
  );
}
