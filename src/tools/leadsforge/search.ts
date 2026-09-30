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

const searchFilters = {
  leadLocations: includeExclude.describe("Contact location filter, e.g. { include: ['United States'] }"),
  companyLocations: includeExclude.describe("Company HQ location filter"),
  companyNiches: includeExclude.describe("Company niche filter"),
  companyBusinessModels: includeExclude.describe("Company business model filter, e.g. { include: ['b2b'] }"),
  leadLanguages: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      primaryOnly: z.boolean().optional(),
    })
    .optional()
    .describe("Contact language filter. primaryOnly=true matches only the contact's primary language"),
  companyIndustries: includeExclude.describe("Company industry filter. Uses LinkedIn's standard industry taxonomy (exact match, lowercase). For free-form descriptors like 'lead generation' that aren't in the taxonomy, use companyKeywords instead."),
  leadSeniorities: includeExclude.describe("Seniority filter, e.g. { include: ['c_suite','owner','founder','director','vp','manager','head'] }"),
  leadDepartments: includeExclude.describe("Department filter, e.g. { include: ['c_suite','master_sales'] }"),
  leadJobTitles: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      exactMatch: z.boolean().optional(),
    })
    .optional()
    .describe("Job title filter. exactMatch=true matches the whole title instead of a phrase inside it"),
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
  leadLinkedInURLs: z.array(z.string()).optional().describe("Find these exact people by their LinkedIn profile URLs"),
  matchedEntityIDs: z
    .object({
      companyIDs: z.array(z.string()).optional(),
      personIDs: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Match a contact if its company is in companyIDs OR the contact is in personIDs. With only one side filled it is the same as companyIDs.include or leadIDs.include"),
  excludeEmails: z.array(z.string()).optional().describe("Skip contacts with these email addresses, e.g. people you already own"),
  excludeDomains: z.array(z.string()).optional().describe("Skip contacts at these company domains"),
  excludeLinkedInURLs: z.array(z.string()).optional().describe("Skip contacts with these LinkedIn profile URLs"),
};

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
        ...searchFilters,
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

  server.registerTool(
    "leadsforge_count_search_results",
    {
      description: "Count leads matching a filter set without returning them. Free. Same filters as leadsforge_search, no limit or cursor. Use it to size an audience before searching.",
      inputSchema: searchFilters,
    },
    (body) => handleTool(() => client.post("/search/count", body)),
  );

  server.registerTool(
    "leadsforge_get_search_industry_filters",
    {
      description: "Search the industry values accepted by companyIndustries in leadsforge_search. Values are exact and case sensitive, send them verbatim.",
      inputSchema: {
        search: z.string().optional().describe("Filter industries by name"),
        limit: z.number().optional().describe("Max values (1-100; defaults to 100)"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ search, limit, offset }) =>
      handleTool(() => client.get("/search/filters/industries", buildQuery({ search, limit: limit ?? 100, offset }))),
  );

  server.registerTool(
    "leadsforge_get_search_seniority_filters",
    {
      description: "Get the seniority values accepted by leadSeniorities in leadsforge_search",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/search/filters/seniorities")),
  );

  server.registerTool(
    "leadsforge_get_search_department_filters",
    {
      description: "Get the department values accepted by leadDepartments in leadsforge_search",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/search/filters/departments")),
  );

  server.registerTool(
    "leadsforge_get_search_company_type_filters",
    {
      description: "Get the company type values accepted by companyTypes in leadsforge_search",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/search/filters/company-types")),
  );

  server.registerTool(
    "leadsforge_get_search_funding_type_filters",
    {
      description: "Get the funding round values accepted by companyFundingRounds in leadsforge_search",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/search/filters/funding-types")),
  );

  server.registerTool(
    "leadsforge_get_search_revenue_range_filters",
    {
      description: "Get the revenue range values accepted by companyRevenueRanges in leadsforge_search",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/search/filters/revenue-ranges")),
  );
}
