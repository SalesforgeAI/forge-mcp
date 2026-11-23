import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, ApiError } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { idSchema, pageSchema, sizeSchema } from "./schemas.js";

const leadSchema = z.strictObject({
  email: z.string().describe("Lead email; one link per email per meeting link"),
  lead: z
    .strictObject({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      company: z.string().optional(),
      company_logo: z.string().optional().describe("https:// URL"),
      job_title: z.string().optional(),
      industry: z.string().optional(),
    })
    .optional()
    .describe("Fills the booking page's {{first_name}}, {{company}}… variables"),
  externalLeadId: z
    .string()
    .optional()
    .describe("Your id for the lead. For a Salesforge contact use sf:lead:<contact id>"),
  context: z.record(z.string(), z.unknown()).optional().describe("Your own JSON data, up to 4 KB, sent back on webhooks"),
});

type Lead = z.infer<typeof leadSchema>;

export type LeadLinkResult =
  | { ok: true; leadLink: unknown }
  | { ok: false; email: string; error: string };

export async function createLeadLinks(
  client: ApiClient,
  meetingLinkId: string,
  leads: Lead[],
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<{ results: LeadLinkResult[] }> {
  const createOne = async ({ email, lead, externalLeadId, context }: Lead) => {
    const create = () => client.post("/lead-links", { meetingLinkId, email, lead, externalLeadId, context });
    try {
      return await create();
    } catch (error) {
      const wait = retryAfterMs(error);
      if (wait === undefined) throw error;
      await sleep(wait);
      return create();
    }
  };

  const results: LeadLinkResult[] = [];
  for (const lead of leads) {
    try {
      results.push({ ok: true, leadLink: await createOne(lead) });
    } catch (error) {
      results.push({ ok: false, email: lead.email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { results };
}

export function registerCalendioLeadLinkTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "calendio_create_lead_links",
    {
      description: [
        "Create a personal Calendio booking link for each lead on one meeting link (get meetingLinkId from calendio_list_meeting_links).",
        "Repeats are safe. An email already linked to that meeting link gets its existing link back.",
        "For a lead from Salesforge, set externalLeadId to sf:lead:<Salesforge contact id>; Salesforge only acts on meeting events with that prefix.",
        "Returns { results } in the same order as leads; each is { ok: true, leadLink } or { ok: false, email, error }, and one failure does not stop the rest.",
        "leadLink.url is the lead's personal booking link. Store it on the Salesforge contact as a custom variable (e.g. bulk_update_contacts with customVars booking_link) and use {{booking_link}} in sequence emails.",
      ].join(" "),
      inputSchema: z.strictObject({
        meetingLinkId: idSchema.describe("Meeting link the leads book"),
        leads: z.array(leadSchema).min(1).max(100).describe("Leads to create links for (1-100)"),
      }),
    },
    ({ meetingLinkId, leads }) => handleTool(() => createLeadLinks(client, meetingLinkId, leads)),
  );

  server.registerTool(
    "calendio_list_lead_links",
    {
      description: [
        "List Calendio lead links (paginated, oldest first by default) with each lead's current meeting.",
        "meetingOutcome needed matches meetings that ended and still need an outcome. Set it with calendio_set_meeting_outcome.",
        "meetingTime upcoming with order starts gives the agenda of coming meetings.",
        "viewCount on each link shows how often the lead opened it.",
      ].join(" "),
      inputSchema: z.strictObject({
        page: pageSchema,
        size: sizeSchema,
        search: z.string().optional().describe("Search the lead's name, email or company"),
        meetingLinkId: z.array(idSchema).optional().describe("Only these meeting links"),
        meetingStatus: z.array(z.enum(["not-booked", "booked", "rescheduled", "cancelled"])).optional()
          .describe("Only these current meeting statuses (not-booked: none yet)"),
        meetingOutcome: z.array(z.enum(["needed", "pending", "held", "no-show", "unknown"])).optional()
          .describe("Only these current meeting outcomes"),
        meetingTime: z.enum(["upcoming", "past"]).optional()
          .describe("Meeting not ended yet (upcoming) or ended (past); unbooked links match neither"),
        order: z.enum(["created", "created-desc", "starts", "starts-desc"]).optional()
          .describe("created (default), created-desc, starts (soonest meeting first), starts-desc"),
      }),
    },
    ({ page, size, search, meetingLinkId, meetingStatus, meetingOutcome, meetingTime, order }) =>
      handleTool(() =>
        client.get(
          "/lead-links",
          buildQuery({ page, size, search, meetingLinkId, meetingStatus, meetingOutcome, meetingTime, order }),
        ),
      ),
  );

  server.registerTool(
    "calendio_get_lead_link",
    {
      description: "Get a Calendio lead link by ID, with its current meeting",
      inputSchema: z.strictObject({ id: idSchema.describe("Lead link ID") }),
    },
    ({ id }) => handleTool(() => client.get(`/lead-links/${enc(id)}`)),
  );

  server.registerTool(
    "calendio_delete_lead_link",
    {
      description: "Delete a Calendio lead link; its booking URL stops working",
      inputSchema: z.strictObject({ id: idSchema.describe("Lead link ID") }),
    },
    ({ id }) => handleTool(() => client.delete(`/lead-links/${enc(id)}`)),
  );

  server.registerTool(
    "calendio_set_meeting_outcome",
    {
      description: "Set the outcome of a lead link's current meeting: held, no-show or unknown. pending undoes an outcome set by mistake.",
      inputSchema: z.strictObject({
        id: idSchema.describe("Lead link ID"),
        outcome: z.enum(["pending", "held", "no-show", "unknown"]),
      }),
    },
    ({ id, outcome }) => handleTool(() => client.put(`/lead-links/${enc(id)}/meeting/outcome`, { outcome })),
  );
}

const MAX_RETRY_WAIT_SECONDS = 60;

function retryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof ApiError) || error.statusCode !== 429) return undefined;
  let seconds = 1;
  try {
    const parsed = JSON.parse(error.body)?.retryAfterSeconds;
    if (typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0) seconds = parsed;
  } catch {
    // An unparsable body keeps the 1 s default.
  }
  return Math.min(seconds, MAX_RETRY_WAIT_SECONDS) * 1000;
}

function realSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
