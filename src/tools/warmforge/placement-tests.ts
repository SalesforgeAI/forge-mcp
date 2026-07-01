import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { optionalWorkspaceIdSchema, resolveWarmforgePath } from "./workspaces.js";

export function registerWarmforgePlacementTestTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "warmforge_create_placement_test",
    {
      description: "Create a Warmforge placement test",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        body: z.record(z.string(), z.any()).describe("Placement test payload"),
      },
    },
    ({ workspaceId, body }) =>
      handleTool(() => client.post(resolveWarmforgePath(workspaceId, "/placement-tests"), body)),
  );

  server.registerTool(
    "warmforge_list_placement_tests",
    {
      description: "List Warmforge placement tests (paginated)",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        page: z.number().describe("Page number (starts at 1)"),
        size: z.number().describe("Results per page (1-50)"),
        search: z.string().optional().describe("Search filter"),
        external_reference: z.string().optional().describe("Filter by external reference"),
      },
    },
    ({ workspaceId, page, size, search, external_reference }) =>
      handleTool(() =>
        client.get(
          resolveWarmforgePath(workspaceId, "/placement-tests"),
          buildQuery({ page, size, search, external_reference }),
        ),
      ),
  );

  server.registerTool(
    "warmforge_get_latest_mailbox_placement_results",
    {
      description: "Get the latest completed Warmforge placement test result for each mailbox ID",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        mailboxIds: z.array(z.string()).min(1).max(100).describe("Mailbox IDs to fetch latest placement results for"),
      },
    },
    ({ workspaceId, mailboxIds }) =>
      handleTool(() =>
        client.post(resolveWarmforgePath(workspaceId, "/mailboxes/placement-results/latest"), { mailboxIds }),
      ),
  );

  server.registerTool(
    "warmforge_get_placement_test",
    {
      description: "Get a Warmforge placement test by ID",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        placementTestID: z.string().describe("Placement test ID"),
      },
    },
    ({ workspaceId, placementTestID }) =>
      handleTool(() =>
        client.get(resolveWarmforgePath(workspaceId, `/placement-tests/${enc(placementTestID)}`)),
      ),
  );

  server.registerTool(
    "warmforge_delete_placement_test",
    {
      description: "Delete a Warmforge placement test",
      inputSchema: {
        workspaceId: optionalWorkspaceIdSchema,
        placementTestID: z.string().describe("Placement test ID"),
      },
    },
    ({ workspaceId, placementTestID }) =>
      handleTool(() =>
        client.delete(resolveWarmforgePath(workspaceId, `/placement-tests/${enc(placementTestID)}`)),
      ),
  );
}
