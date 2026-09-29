import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery, enc } from "../../helpers.js";

export function registerLeadsforgeFollowersTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_search_company_followers",
    {
      description: "Pull the people who follow a LinkedIn company page. Async, returns a jobID: poll leadsforge_get_company_followers_job and read the people with leadsforge_get_company_followers_results. Charged per follower collected. Filter values come from the leadsforge_get_followers_* tools.",
      inputSchema: {
        linkedinUrl: z.string().describe("LinkedIn company page URL, e.g. https://www.linkedin.com/company/salesforge"),
        limit: z.number().describe("How many followers to collect (1-50000)"),
        countries: z.array(z.string()).optional().describe("Country filter"),
        states: z.array(z.string()).optional().describe("State filter"),
        jobTitles: z.array(z.string()).optional().describe("Job title filter"),
        departments: z.array(z.string()).optional().describe("Department filter"),
        levels: z.array(z.string()).optional().describe("Seniority level filter"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
      },
    },
    (body) => handleTool(() => client.post("/company-followers/search", body)),
  );

  server.registerTool(
    "leadsforge_get_company_followers_job",
    {
      description: "Get status of a company followers job",
      inputSchema: {
        jobID: z.string().describe("Company followers job ID"),
      },
    },
    ({ jobID }) => handleTool(() => client.get(`/company-followers/jobs/${enc(jobID)}`)),
  );

  server.registerTool(
    "leadsforge_get_company_followers_results",
    {
      description: "Get the followers collected by a company followers job. Person IDs here can be sent to leadsforge_enrich_emails and leadsforge_enrich_phones.",
      inputSchema: {
        jobID: z.string().describe("Company followers job ID"),
        limit: z.number().optional().describe("Max results (1-500; defaults to 100)"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ jobID, limit, offset }) =>
      handleTool(() =>
        client.get(`/company-followers/jobs/${enc(jobID)}/results`, buildQuery({ limit: limit ?? 100, offset })),
      ),
  );

  server.registerTool(
    "leadsforge_list_company_followers_jobs",
    {
      description: "List past and running company followers jobs, newest first",
      inputSchema: {
        limit: z.number().optional().describe("Max jobs (1-100; defaults to 25)"),
        offset: z.number().optional().describe("Offset"),
        status: z.enum(["in_progress", "completed", "failed", "no_results"]).optional().describe("Filter by status"),
        clientRequestID: z.string().optional().describe("Filter by your own request ID"),
        from: z.string().optional().describe("Created after, RFC3339"),
        to: z.string().optional().describe("Created before, RFC3339"),
      },
    },
    ({ limit, offset, status, clientRequestID, from, to }) =>
      handleTool(() =>
        client.get(
          "/company-followers/jobs",
          buildQuery({ limit: limit ?? 25, offset, status, clientRequestID, from, to }),
        ),
      ),
  );

  server.registerTool(
    "leadsforge_get_followers_country_filters",
    {
      description: "Get the country values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/company-followers/filters/countries")),
  );

  server.registerTool(
    "leadsforge_get_followers_state_filters",
    {
      description: "Get the state values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/company-followers/filters/states")),
  );

  server.registerTool(
    "leadsforge_get_followers_department_filters",
    {
      description: "Get the department values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/company-followers/filters/departments")),
  );

  server.registerTool(
    "leadsforge_get_followers_level_filters",
    {
      description: "Get the seniority level values accepted by leadsforge_search_company_followers",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/company-followers/filters/levels")),
  );

  server.registerTool(
    "leadsforge_get_followers_job_title_filters",
    {
      description: "Search the job title values accepted by leadsforge_search_company_followers",
      inputSchema: {
        search: z.string().optional().describe("Filter job titles by name"),
        page: z.number().optional().describe("Page number (min 1)"),
        pageSize: z.number().optional().describe("Page size (1-20)"),
      },
    },
    ({ search, page, pageSize }) =>
      handleTool(() =>
        client.get("/company-followers/filters/job-titles", buildQuery({ search, page, page_size: pageSize })),
      ),
  );
}
