import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery, enc } from "../../helpers.js";

export function registerLeadsforgeMapsTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_search_local_businesses",
    {
      description: "Find local businesses on Google Maps around a point. Async, returns a jobID: poll leadsforge_get_maps_search_job and read the businesses with leadsforge_get_maps_search_results. Charged per business found. Category suggestions come from leadsforge_get_maps_category_filters, free text also works.",
      inputSchema: {
        categories: z.array(z.string()).describe("Business categories to look for, e.g. ['dentist','orthodontist']. Combined with OR (1-100 items)."),
        lat: z.number().describe("Latitude of the centre point (-90 to 90)"),
        lng: z.number().describe("Longitude of the centre point (-180 to 180)"),
        radiusKm: z.number().describe("Search radius in km (up to 500)"),
        limit: z.number().describe("How many businesses to collect (1-5000)"),
        language: z.string().optional().describe("Language code for the results, e.g. 'en'"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
      },
    },
    (body) => handleTool(() => client.post("/maps-discovery/search", body)),
  );

  server.registerTool(
    "leadsforge_get_maps_search_job",
    {
      description: "Get status of a local business search job",
      inputSchema: {
        jobID: z.string().describe("Maps search job ID"),
      },
    },
    ({ jobID }) => handleTool(() => client.get(`/maps-discovery/jobs/${enc(jobID)}`)),
  );

  server.registerTool(
    "leadsforge_get_maps_search_results",
    {
      description: "Get the businesses found by a local business search job. Business IDs here go into leadsforge_enrich_business_owners.",
      inputSchema: {
        jobID: z.string().describe("Maps search job ID"),
        limit: z.number().optional().describe("Max results (1-200; defaults to 50)"),
        offset: z.number().optional().describe("Offset (up to 5000)"),
      },
    },
    ({ jobID, limit, offset }) =>
      handleTool(() => client.get(`/maps-discovery/jobs/${enc(jobID)}/results`, buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "leadsforge_list_maps_search_jobs",
    {
      description: "List past and running local business search jobs, newest first",
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
        client.get("/maps-discovery/jobs", buildQuery({ limit: limit ?? 25, offset, status, clientRequestID, from, to })),
      ),
  );

  server.registerTool(
    "leadsforge_enrich_business_owners",
    {
      description: "Find the owners of businesses from a local business search, with their email and phone. Async, returns a jobID: poll leadsforge_get_maps_owner_job and read the people with leadsforge_get_maps_owner_results. Charged per contact found, a business with no owner is free. Only one owner job per search runs at a time.",
      inputSchema: {
        searchJobID: z.string().describe("The maps search job the businesses came from"),
        businessIDs: z.array(z.string()).describe("Business IDs from leadsforge_get_maps_search_results (1-200)"),
        maxResults: z.number().describe("Owners to look for per business (1-8)"),
        wantEmail: z.boolean().optional().describe("Look for emails"),
        wantPhone: z.boolean().optional().describe("Look for phone numbers"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
      },
    },
    (body) => handleTool(() => client.post("/maps-discovery/enrich-owners", body)),
  );

  server.registerTool(
    "leadsforge_get_maps_owner_job",
    {
      description: "Get status of a business owner enrichment job",
      inputSchema: {
        jobID: z.string().describe("Maps owner job ID"),
      },
    },
    ({ jobID }) => handleTool(() => client.get(`/maps-discovery/owner-jobs/${enc(jobID)}`)),
  );

  server.registerTool(
    "leadsforge_get_maps_owner_results",
    {
      description: "Get the owners found by a business owner enrichment job, with email and phone status per person",
      inputSchema: {
        jobID: z.string().describe("Maps owner job ID"),
        limit: z.number().optional().describe("Max results (1-200; defaults to 50)"),
        offset: z.number().optional().describe("Offset (up to 5000)"),
      },
    },
    ({ jobID, limit, offset }) =>
      handleTool(() => client.get(`/maps-discovery/owner-jobs/${enc(jobID)}/results`, buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "leadsforge_list_maps_owner_jobs",
    {
      description: "List past and running business owner enrichment jobs, newest first",
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
          "/maps-discovery/owner-jobs",
          buildQuery({ limit: limit ?? 25, offset, status, clientRequestID, from, to }),
        ),
      ),
  );

  server.registerTool(
    "leadsforge_get_maps_category_filters",
    {
      description: "Get recommended business categories for leadsforge_search_local_businesses",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/maps-discovery/filters/categories")),
  );
}
