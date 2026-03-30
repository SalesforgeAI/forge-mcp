import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerWarmforgeMailboxTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "warmforge_list_mailboxes",
    {
      description: "List Warmforge mailboxes (paginated). Status: warm, pending, disconnected, suspended, all",
      inputSchema: {
        page: z.number().describe("Page number (starts at 1)"),
        page_size: z.number().describe("Results per page (1-100)"),
        search: z.string().optional().describe("Search filter"),
        status: z.string().optional().describe("Filter by status: warm, pending, disconnected, suspended, all"),
        external_reference: z.string().optional().describe("Filter by external reference"),
      },
    },
    ({ page, page_size, search, status, external_reference }) =>
      handleTool(() => client.get("/mailboxes", buildQuery({ page, page_size, search, status, external_reference }))),
  );

  server.registerTool(
    "warmforge_get_mailbox",
    {
      description: "Get a Warmforge mailbox by email address",
      inputSchema: {
        address: z.string().describe("Email address"),
      },
    },
    ({ address }) => handleTool(() => client.get(`/mailboxes/${encodeURIComponent(address)}`)),
  );

  server.registerTool(
    "warmforge_connect_smtp_mailbox",
    {
      description: "Connect an SMTP mailbox to Warmforge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("SMTP connection payload (address, firstName, lastName, smtp/imap config, warmup settings)"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/connect-smtp", body)),
  );

  server.registerTool(
    "warmforge_connect_oauth2_mailbox",
    {
      description: "Connect an OAuth2 mailbox to Warmforge",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("OAuth2 connection payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/connect-oauth2", body)),
  );

  server.registerTool(
    "warmforge_update_mailbox",
    {
      description: "Update a Warmforge mailbox",
      inputSchema: {
        address: z.string().describe("Email address"),
        body: z.record(z.string(), z.any()).describe("Update payload (warmup config, name, etc.)"),
      },
    },
    ({ address, body }) => handleTool(() => client.patch(`/mailboxes/${encodeURIComponent(address)}`, body)),
  );

  server.registerTool(
    "warmforge_bulk_update_mailboxes",
    {
      description: "Update multiple Warmforge mailboxes at once",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Bulk update payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/bulk-update", body)),
  );

  server.registerTool(
    "warmforge_delete_mailbox",
    {
      description: "Delete a Warmforge mailbox",
      inputSchema: {
        address: z.string().describe("Email address"),
      },
    },
    ({ address }) => handleTool(() => client.delete(`/mailboxes/${encodeURIComponent(address)}`)),
  );

  server.registerTool(
    "warmforge_get_mailbox_warmup_stats",
    {
      description: "Get warmup statistics for a Warmforge mailbox",
      inputSchema: {
        address: z.string().describe("Email address"),
      },
    },
    ({ address }) => handleTool(() => client.get(`/mailboxes/${encodeURIComponent(address)}/warmup/stats`)),
  );
}
