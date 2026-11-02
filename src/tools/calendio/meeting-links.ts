import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { buildQuery, enc, handleTool } from "../../helpers.js";
import { idSchema, pageSchema, sizeSchema } from "./schemas.js";

export function registerCalendioMeetingLinkTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "calendio_list_meeting_links",
    {
      description: "List Calendio meeting links (paginated, oldest first). A lead link needs a meetingLinkId from here.",
      inputSchema: z.strictObject({
        page: pageSchema,
        size: sizeSchema,
        groupId: idSchema.optional().describe("Only this link group's meeting links"),
      }),
    },
    ({ page, size, groupId }) =>
      handleTool(() => client.get("/meeting-links", buildQuery({ page, size, groupId }))),
  );

  server.registerTool(
    "calendio_set_meeting_link_active",
    {
      description: "Turn a Calendio meeting link on or off. An inactive link takes no bookings.",
      inputSchema: z.strictObject({
        id: idSchema.describe("Meeting link ID"),
        isActive: z.boolean(),
      }),
    },
    ({ id, isActive }) => handleTool(() => client.put(`/meeting-links/${enc(id)}/active`, { isActive })),
  );

  server.registerTool(
    "calendio_list_availabilities",
    {
      description: "List Calendio availabilities (weekly working-hour schedules) used by meeting links (paginated)",
      inputSchema: z.strictObject({
        page: pageSchema,
        size: sizeSchema,
        search: z.string().optional().describe("Search by name"),
      }),
    },
    ({ page, size, search }) =>
      handleTool(() => client.get("/availabilities", buildQuery({ page, size, search }))),
  );
}
