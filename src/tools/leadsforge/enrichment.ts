import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool, buildQuery } from "../../helpers.js";

const personInput = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  companyDomain: z.string().optional(),
  linkedinURL: z.string().optional(),
  externalID: z.string().optional(),
});

const syncEnrichmentInput = {
  personID: z.string().optional().describe("Person ID from a prior leadsforge_search"),
  linkedinURL: z.string().optional().describe("LinkedIn profile URL"),
  firstName: z.string().optional().describe("First name, needs a company signal too"),
  lastName: z.string().optional().describe("Last name, needs a company signal too"),
  companyDomain: z.string().optional().describe("Company domain, preferred company signal"),
  company: z.string().optional().describe("Company name, weaker fallback for companyDomain"),
  externalID: z.string().optional().describe("Your own ID, echoed back (max 128 chars)"),
};

const enrichmentInput = {
  personIDs: z.array(z.string()).optional().describe("Person IDs from a prior leadsforge_search. Provide either this OR `people`."),
  people: z.array(personInput).optional().describe("Free-form people to enrich (no prior search needed). Each: { firstName?, lastName?, company?, companyDomain?, linkedinURL?, externalID? }. companyDomain beats company name. externalID is echoed back on the result. Provide either this OR `personIDs`."),
  webhookURL: z.string().optional().describe("Webhook URL for completion notification"),
  clientRequestID: z.string().optional().describe("Client request ID for tracking (max 128 chars)"),
  saveToList: z.boolean().optional().describe("Also save the enriched people into a LeadsForge list"),
};

type EnrichmentBody = {
  personIDs?: string[];
  people?: unknown[];
};

function assertPersonsXOR(body: EnrichmentBody): void {
  const hasIDs = (body.personIDs?.length ?? 0) > 0;
  const hasPeople = (body.people?.length ?? 0) > 0;
  if (hasIDs === hasPeople) {
    throw new Error("Provide exactly one of `personIDs` or `people` (non-empty).");
  }
}

export function registerLeadsforgeEnrichmentTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_enrich_emails",
    {
      description: "Find email addresses. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => {
      assertPersonsXOR(body);
      return client.post("/enrichment/emails", body);
    }),
  );

  server.registerTool(
    "leadsforge_enrich_phones",
    {
      description: "Find phone numbers. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => {
      assertPersonsXOR(body);
      return client.post("/enrichment/phones", body);
    }),
  );

  server.registerTool(
    "leadsforge_enrich_linkedin",
    {
      description: "Find LinkedIn profiles. Async — returns a jobID; poll leadsforge_get_enrichment_job and fetch results with leadsforge_get_enrichment_results.",
      inputSchema: enrichmentInput,
    },
    (body) => handleTool(() => {
      assertPersonsXOR(body);
      return client.post("/enrichment/linkedin", body);
    }),
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
        limit: z.number().optional().describe("Max results (defaults to 100; server rejects omission)"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ jobID, limit, offset }) =>
      handleTool(() => client.get(`/enrichment/jobs/${jobID}/results`, buildQuery({ limit: limit ?? 100, offset }))),
  );

  server.registerTool(
    "leadsforge_enrich_email_sync",
    {
      description: "Find one person's work email and get it in the same response, no job polling. Identify them with personID, linkedinURL, or firstName + lastName + companyDomain. Costs 1 credit on a hit, a miss is free.",
      inputSchema: syncEnrichmentInput,
    },
    (body) => handleTool(() => client.post("/enrichment/email", body)),
  );

  server.registerTool(
    "leadsforge_enrich_phone_sync",
    {
      description: "Find one person's phone number and get it in the same response, no job polling. Identify them with personID, linkedinURL, or firstName + lastName + companyDomain. Costs 10 credits on a hit, a miss is free.",
      inputSchema: syncEnrichmentInput,
    },
    (body) => handleTool(() => client.post("/enrichment/phone", body)),
  );

  server.registerTool(
    "leadsforge_list_enrichment_jobs",
    {
      description: "List past and running enrichment jobs, newest first",
      inputSchema: {
        limit: z.number().optional().describe("Max jobs (1-100; defaults to 25)"),
        offset: z.number().optional().describe("Offset"),
        status: z.enum(["in_progress", "completed", "failed"]).optional().describe("Filter by status"),
        channel: z.enum(["email", "phone", "linkedin"]).optional().describe("Filter by channel"),
        clientRequestID: z.string().optional().describe("Filter by your own request ID"),
        from: z.string().optional().describe("Created after, RFC3339"),
        to: z.string().optional().describe("Created before, RFC3339"),
      },
    },
    ({ limit, offset, status, channel, clientRequestID, from, to }) =>
      handleTool(() =>
        client.get(
          "/enrichment/jobs",
          buildQuery({ limit: limit ?? 25, offset, status, channel, clientRequestID, from, to }),
        ),
      ),
  );
}
