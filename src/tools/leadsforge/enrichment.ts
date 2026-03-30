import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

export function registerLeadsforgeEnrichmentTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_enrich_emails",
    {
      description: "Find email addresses for a list of person IDs",
      inputSchema: {
        personIDs: z.array(z.string()).describe("Person IDs to enrich (1-500)"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking"),
      },
    },
    (body) => handleTool(() => client.post("/enrichment/emails", body)),
  );

  server.registerTool(
    "leadsforge_enrich_phones",
    {
      description: "Find phone numbers for a list of person IDs",
      inputSchema: {
        personIDs: z.array(z.string()).describe("Person IDs to enrich (1-500)"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking"),
      },
    },
    (body) => handleTool(() => client.post("/enrichment/phones", body)),
  );

  server.registerTool(
    "leadsforge_enrich_linkedin",
    {
      description: "Find LinkedIn profiles for a list of person IDs",
      inputSchema: {
        personIDs: z.array(z.string()).describe("Person IDs to enrich (1-500)"),
        webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
        clientRequestID: z.string().optional().describe("Client request ID for tracking"),
      },
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
