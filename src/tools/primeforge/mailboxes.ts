import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerPrimeforgeMailboxTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "primeforge_list_mailboxes",
    {
      description: "List PrimeForge mailboxes",
      inputSchema: {
        workspaceId: z.string().optional().describe("Filter by workspace ID"),
      },
    },
    ({ workspaceId }) =>
      handleTool(() => client.get("/mailboxes", buildQuery({ workspaceId }))),
  );

  server.registerTool(
    "primeforge_get_mailbox",
    {
      description: "Get a PrimeForge mailbox by ID",
      inputSchema: {
        id: z.string().describe("Mailbox ID"),
      },
    },
    ({ id }) => handleTool(() => client.get(`/mailboxes/${id}`)),
  );

  server.registerTool(
    "primeforge_update_mailbox",
    {
      description: "Update a PrimeForge mailbox",
      inputSchema: {
        id: z.string().describe("Mailbox ID"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        signature: z.string().optional(),
        forwardingEmail: z.string().optional(),
        profilePictureUrl: z.string().optional(),
      },
    },
    ({ id, ...body }) => handleTool(() => client.patch(`/mailboxes/${id}`, body)),
  );

  server.registerTool(
    "primeforge_delete_mailbox",
    {
      description: "Delete a PrimeForge mailbox",
      inputSchema: {
        id: z.string().describe("Mailbox ID"),
      },
    },
    ({ id }) => handleTool(() => client.delete(`/mailboxes/${id}`)),
  );

  server.registerTool(
    "primeforge_list_prewarmed_mailboxes",
    {
      description: "List available pre-warmed mailboxes for purchase",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/mailboxes/pre-warmed")),
  );

  server.registerTool(
    "primeforge_purchase_prewarmed_mailboxes",
    {
      description: "Purchase pre-warmed mailboxes",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Purchase payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/mailboxes/pre-warmed", body)),
  );
}
