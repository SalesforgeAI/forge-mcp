import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

const lookalikeFilters = {
  domains: z.array(z.string()).describe("Company domains to find lookalikes for (1-10)"),
  locations: z.array(z.object({
    id: z.string().describe("Location ID (use leadsforge_get_* filter tools to discover valid IDs)"),
    type: z.enum(["region", "country"]).describe("Location type"),
  })).optional().describe("Location filters — each entry is { id, type }"),
  employeeRanges: z.array(z.string()).optional().describe("Employee range filters"),
  fundingStages: z.array(z.string()).optional().describe("Funding stage filters"),
  categories: z.array(z.string()).optional().describe("Category filters"),
};

export function registerLeadsforgeLookalikesTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_search_lookalikes",
    {
      description: "Search for companies similar to provided domains. Costs 1 credit per company returned. Use leadsforge_preview_lookalikes first for a free look.",
      inputSchema: {
        ...lookalikeFilters,
        page: z.number().optional().describe("Page number (min 1; defaults to 1 — server rejects omission)"),
        pageSize: z.number().optional().describe("Page size (1-100; defaults to 25)"),
      },
    },
    (body) => handleTool(() => client.post("/lookalikes/search", { ...body, page: body.page ?? 1, pageSize: body.pageSize ?? 25 })),
  );

  server.registerTool(
    "leadsforge_preview_lookalikes",
    {
      description: "Free preview of companies similar to provided domains. No credits, company details only. To get people at those companies, pass a returned domain into leadsforge_search as companyDomains.include.",
      inputSchema: lookalikeFilters,
    },
    (body) => handleTool(() => client.post("/lookalikes/preview", body)),
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

  server.registerTool(
    "leadsforge_get_lookalikes_location_filters",
    {
      description: "Get the location IDs accepted by the locations filter in leadsforge_search_lookalikes and leadsforge_preview_lookalikes",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/lookalikes/filters/locations")),
  );
}
