import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

export function registerLeadsforgeLookalikesTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_search_lookalikes",
    {
      description: "Search for companies similar to provided domains",
      inputSchema: {
        domains: z.array(z.string()).describe("Company domains to find lookalikes for (1-10)"),
        locations: z.array(z.object({
          country: z.string().optional(),
          state: z.string().optional(),
          city: z.string().optional(),
        })).optional().describe("Location filters"),
        employeeRanges: z.array(z.string()).optional().describe("Employee range filters"),
        fundingStages: z.array(z.string()).optional().describe("Funding stage filters"),
        categories: z.array(z.string()).optional().describe("Category filters"),
        page: z.number().optional().describe("Page number"),
        pageSize: z.number().optional().describe("Page size (1-100)"),
      },
    },
    (body) => handleTool(() => client.post("/lookalikes/search", body)),
  );

  server.registerTool(
    "leadsforge_get_seniority_filters",
    {
      description: "Get available seniority filter values for LeadsForge",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/lookalikes/filters/seniorities")),
  );

  server.registerTool(
    "leadsforge_get_department_filters",
    {
      description: "Get available department filter values for LeadsForge",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/lookalikes/filters/departments")),
  );

  server.registerTool(
    "leadsforge_get_employee_range_filters",
    {
      description: "Get available employee range filter values for LeadsForge",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/lookalikes/filters/employee-ranges")),
  );
}
