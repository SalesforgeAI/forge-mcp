import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerWarmforgePlacementTestTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "warmforge_create_placement_test",
    {
      description: "Create a Warmforge placement test",
      inputSchema: {
        body: z.record(z.string(), z.any()).describe("Placement test payload"),
      },
    },
    ({ body }) => handleTool(() => client.post("/placement-tests", body)),
  );

  server.registerTool(
    "warmforge_list_placement_tests",
    {
      description: "List Warmforge placement tests (paginated)",
      inputSchema: {
        page: z.number().describe("Page number (starts at 1)"),
        size: z.number().describe("Results per page (1-50)"),
        search: z.string().optional().describe("Search filter"),
        external_reference: z.string().optional().describe("Filter by external reference"),
      },
    },
    ({ page, size, search, external_reference }) =>
      handleTool(() => client.get("/placement-tests", buildQuery({ page, size, search, external_reference }))),
  );

  server.registerTool(
    "warmforge_get_placement_test",
    {
      description: "Get a Warmforge placement test by ID",
      inputSchema: {
        placementTestID: z.string().describe("Placement test ID"),
      },
    },
    ({ placementTestID }) => handleTool(() => client.get(`/placement-tests/${placementTestID}`)),
  );

  server.registerTool(
    "warmforge_delete_placement_test",
    {
      description: "Delete a Warmforge placement test",
      inputSchema: {
        placementTestID: z.string().describe("Placement test ID"),
      },
    },
    ({ placementTestID }) => handleTool(() => client.delete(`/placement-tests/${placementTestID}`)),
  );
}
