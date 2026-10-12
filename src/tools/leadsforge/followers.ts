import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery, enc, idempotency } from "../../helpers.js";

export function registerLeadsforgeFollowersTools(server: McpServer, client: ApiClient) {
  // Followers moved to ScrapeLi under /public/v2; the rest of the LeadsForge API stays on v1.
  const api = client.withBasePath((base) => base.replace(/\/v1$/, "/v2"));

  server.registerTool(
    "leadsforge_search_company_followers",
    {
      description:
        "Pull the people who follow a LinkedIn company page (ScrapeLi). Async, returns a jobID: poll leadsforge_get_company_followers_job and read the people with leadsforge_get_company_followers_results. Without filters it collects every follower (or the first `limit`); with filters it targets a segment. Runs minutes to hours for large companies. Charged per follower collected. Filter values come from the leadsforge_get_followers_* tools.",
      inputSchema: z.strictObject({
        companyUrl: z.string().describe("LinkedIn company page URL, e.g. https://www.linkedin.com/company/salesforge"),
        limit: z.number().describe("How many followers to collect (1-50000)"),
        enrichEmails: z.boolean().optional().describe("Also find verified work emails for each follower (extra credits)"),
        countries: z.array(z.string()).optional().describe("Country filter"),
        states: z.array(z.string()).optional().describe("State filter"),
        jobTitles: z.array(z.string()).optional().describe("Job title filter"),
        departments: z.array(z.string()).optional().describe("Department filter"),
        levels: z.array(z.string()).optional().describe("Seniority level filter"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
        idempotencyKey: z.string().optional().describe("Send the same key to retry safely: a repeat returns the job already created instead of a second one"),
      }),
    },
    ({ idempotencyKey, ...body }) =>
      handleTool(() => api.post("/company-followers/search", body, undefined, idempotency(idempotencyKey))),
  );

  server.registerTool(
    "leadsforge_get_company_followers_job",
    {
      description: "Get status of a company followers job",
      inputSchema: z.strictObject({
        jobID: z.string().describe("Company followers job ID"),
      }),
    },
    ({ jobID }) => handleTool(() => api.get(`/company-followers/jobs/${enc(jobID)}`)),
  );

  server.registerTool(
    "leadsforge_get_company_followers_results",
    {
      description: "Get the followers collected by a company followers job.",
      inputSchema: z.strictObject({
        jobID: z.string().describe("Company followers job ID"),
        limit: z.number().optional().describe("Max results (1-500; defaults to 100)"),
        offset: z.number().optional().describe("Offset"),
      }),
    },
    ({ jobID, limit, offset }) =>
      handleTool(() =>
        api.get(`/company-followers/jobs/${enc(jobID)}/results`, buildQuery({ limit: limit ?? 100, offset })),
      ),
  );

  server.registerTool(
    "leadsforge_get_followers_country_filters",
    {
      description: "Get the country values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => api.get("/company-followers/filters/countries")),
  );

  server.registerTool(
    "leadsforge_get_followers_state_filters",
    {
      description: "Get the state values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => api.get("/company-followers/filters/states")),
  );

  server.registerTool(
    "leadsforge_get_followers_department_filters",
    {
      description: "Get the department values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => api.get("/company-followers/filters/departments")),
  );

  server.registerTool(
    "leadsforge_get_followers_level_filters",
    {
      description: "Get the seniority level values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => api.get("/company-followers/filters/levels")),
  );

  server.registerTool(
    "leadsforge_get_followers_job_title_filters",
    {
      description: "Search the job title values accepted by leadsforge_search_company_followers",
      inputSchema: z.strictObject({
        search: z.string().optional().describe("Filter job titles by name"),
        page: z.number().optional().describe("Page number (min 1)"),
        pageSize: z.number().optional().describe("Page size (1-20)"),
      }),
    },
    ({ search, page, pageSize }) =>
      handleTool(() =>
        api.get("/company-followers/filters/job-titles", buildQuery({ search, page, page_size: pageSize })),
      ),
  );
}
