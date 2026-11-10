import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { idSchema, pageSchema, sizeSchema } from "./schemas.js";

const groupId = idSchema.describe("Link group ID");

const time = z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/).describe("HH:MM, 24-hour (24:00 allowed as an end)");

export function registerCalendioLinkGroupTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "calendio_list_link_groups",
    {
      description: "List Calendio link groups (paginated). A group is a person (one host) or a round-robin team; its members show their calendar status.",
      inputSchema: z.strictObject({ page: pageSchema, size: sizeSchema }),
    },
    ({ page, size }) => handleTool(() => client.get("/meeting-link-groups", buildQuery({ page, size }))),
  );

  server.registerTool(
    "calendio_get_link_group",
    {
      description: "Get a Calendio link group (a person or a round-robin team) by ID, with its members and their calendar status",
      inputSchema: z.strictObject({ id: groupId }),
    },
    ({ id }) => handleTool(() => client.get(`/meeting-link-groups/${enc(id)}`)),
  );

  server.registerTool(
    "calendio_connect_calendar",
    {
      description: "Start connecting a host's Google or Microsoft calendar to a link group. Returns a consent URL the host opens in a browser.",
      inputSchema: z.strictObject({
        id: groupId,
        provider: z.enum(["google", "microsoft"]),
      }),
    },
    ({ id, provider }) =>
      handleTool(() => client.post(`/meeting-link-groups/${enc(id)}/calendar/authorization`, { provider })),
  );

  server.registerTool(
    "calendio_get_busy_times",
    {
      description: "Get the busy times on a link group's connected calendar between two date-times (at most 62 days apart)",
      inputSchema: z.strictObject({
        id: groupId,
        from: z.iso.datetime({ offset: true }).describe("Start, ISO date-time"),
        to: z.iso.datetime({ offset: true }).describe("End, ISO date-time"),
      }),
    },
    ({ id, from, to }) =>
      handleTool(() => client.get(`/meeting-link-groups/${enc(id)}/calendar/busy`, buildQuery({ from, to }))),
  );

  server.registerTool(
    "calendio_get_date_overrides",
    {
      description: "Get a link group's date overrides: days with different hours, or days off",
      inputSchema: z.strictObject({ id: groupId }),
    },
    ({ id }) => handleTool(() => client.get(`/meeting-link-groups/${enc(id)}/date-overrides`)),
  );

  server.registerTool(
    "calendio_replace_date_overrides",
    {
      description: "Replaces a link group's whole date-override list. Read it first with calendio_get_date_overrides and send the merged list, because days left out lose their override. A date with no intervals is a day off.",
      inputSchema: z.strictObject({
        id: groupId,
        timezone: z.string().max(64).describe("IANA timezone the times are in, e.g. Europe/Warsaw"),
        overrides: z
          .array(
            z.strictObject({
              date: z.iso.date().describe("YYYY-MM-DD"),
              intervals: z.array(z.strictObject({ start: time, end: time })).describe("Hours available that day. No intervals means a day off."),
            }),
          )
          .max(200),
      }),
    },
    ({ id, timezone, overrides }) =>
      handleTool(() => client.put(`/meeting-link-groups/${enc(id)}/date-overrides`, { timezone, overrides })),
  );
}
