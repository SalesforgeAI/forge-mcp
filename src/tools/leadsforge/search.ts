import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

const includeExclude = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .optional();

const minMax = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .optional();

export function registerLeadsforgeSearchTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_get_balance",
    {
      description: "Get LeadsForge credit balance",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/balance")),
  );

  server.registerTool(
    "leadsforge_search",
    {
      description:
        "Search for leads in LeadsForge. Returns lead previews only — emails/LinkedIn require a follow-up call to leadsforge_enrich_emails / leadsforge_enrich_linkedin with the returned person IDs. For pagination, pass the cursor from the previous response as `cursor` — when cursor is set, filters are ignored and the prior result is scrolled.",
      inputSchema: {
        leadLocations: includeExclude.describe("Contact location filter, e.g. { include: ['United States'] }"),
        companyLocations: includeExclude.describe("Company HQ location filter"),
        companyIndustries: includeExclude.describe("Company industry filter"),
        leadSeniorities: includeExclude.describe("Seniority filter, e.g. { include: ['c_suite','owner','founder','director','vp','manager','head'] }"),
        leadDepartments: includeExclude.describe("Department filter, e.g. { include: ['c_suite','master_sales'] }"),
        leadJobTitles: includeExclude.describe("Job title filter"),
        leadIDs: includeExclude.describe("Filter by specific lead/person IDs"),
        companyIDs: includeExclude.describe("Filter by specific company IDs"),
        companyDomains: includeExclude.describe("Company domain filter"),
        companyNames: includeExclude.describe("Company name filter"),
        companyFundingRounds: includeExclude.describe("Funding round filter"),
        companyTypes: includeExclude.describe("Company type filter"),
        companyRequired: z.boolean().optional().describe("If true, only return leads with a matched company"),
        companyKeywords: z
          .object({
            include: z.array(z.string()).optional(),
            exclude: z.array(z.string()).optional(),
            matchAll: z.boolean().optional(),
          })
          .optional()
          .describe("Company keyword filter. matchAll=true requires all includes to match"),
        companyTechnologies: z
          .object({
            any: z.array(z.string()).optional(),
            all: z.array(z.string()).optional(),
          })
          .optional()
          .describe("Company technology filter"),
        companyEmployeeNumberRange: minMax.describe("Employee count range, e.g. { min: 1, max: 50 }. NOT bucket strings."),
        leadTenure: minMax.describe("Tenure in months"),
        companyFoundedYearRange: minMax.describe("Founded year range"),
        companyYearsInBusinessRange: minMax.describe("Years in business range"),
        companyRevenueRanges: z.array(z.string()).optional().describe("Revenue category codes"),
        maxContactsPerCompany: z.number().optional().describe("0-100"),
        limit: z.number().optional().describe("Max results (1-2000)"),
        cursor: z.string().optional().describe("Pagination cursor from previous response. When set, filters are ignored."),
      },
    },
    ({ cursor, ...body }) =>
      handleTool(() =>
        cursor
          ? client.post("/search", {}, buildQuery({ cursor }))
          : client.post("/search", body),
      ),
  );
}
