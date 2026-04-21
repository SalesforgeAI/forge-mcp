import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

const personInput = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  linkedinURL: z.string().optional(),
});

const enrichmentInput = {
  personIDs: z.array(z.string()).optional().describe("Person IDs from a prior leadsforge_search. Provide either this OR `people`."),
  people: z.array(personInput).optional().describe("Free-form people to enrich (no prior search needed). Each: { firstName?, lastName?, company?, linkedinURL? }. Provide either this OR `personIDs`."),
  webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
  clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
};

export function registerLeadsforgeEnrichmentTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_enrich_emails",
    {
      description: "Find email addresses. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => client.post("/enrichment/emails", body)),
  );

  server.registerTool(
    "leadsforge_enrich_phones",
    {
      description: "Find phone numbers. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => client.post("/enrichment/phones", body)),
  );

  server.registerTool(
    "leadsforge_enrich_linkedin",
    {
      description: "Find LinkedIn profiles. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => client.post("/enrichment/linkedin", body)),
  );

  server.registerTool(
    "leadsforge_get_enrichment_job",
    {
      description: "Get status of a LeadsForge enrichment job",
      inputSchema: {
        jobID: z.string().describe("Enrichment job ID"),
      },
    },
    ({ jobID }) => handleTool(() => client.get(`/enrichment/jobs/${jobID}`)),
  );

  server.registerTool(
    "leadsforge_get_enrichment_results",
    {
      description: "Get results of a LeadsForge enrichment job",
      inputSchema: {
        jobID: z.string().describe("Enrichment job ID"),
        limit: z.number().optional().describe("Max results"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ jobID, limit, offset }) =>
      handleTool(() => client.get(`/enrichment/jobs/${jobID}/results`, buildQuery({ limit, offset }))),
  );
}
