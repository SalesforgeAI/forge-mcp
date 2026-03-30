import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

function enrollPath(workspaceId: string, sequenceId: string) {
  return `/multichannel/workspaces/${enc(workspaceId)}/sequences/${enc(sequenceId)}/enrollments`;
}

export function registerEnrollmentTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "enroll_contacts",
    {
      description: "Enroll contacts into a multichannel sequence using filters (lead IDs, tags, ESPs, validation status)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        filters: z
          .object({
            leadIds: z.array(z.string()).optional().describe("Specific lead/contact IDs to enroll"),
            tagIds: z.array(z.string()).optional().describe("Tag IDs to filter contacts"),
            esps: z.array(z.string()).optional().describe("ESP filters"),
            validationRunId: z.string().optional().describe("Validation run ID to filter by"),
            validationStatuses: z
              .array(z.string())
              .optional()
              .describe("Validation statuses: safe, invalid, catch_all, unknown, etc."),
            hasEmail: z.boolean().optional().describe("Filter contacts that have email"),
            hasValidLinkedIn: z.boolean().optional().describe("Filter contacts with valid LinkedIn"),
          })
          .describe("Filters to select contacts for enrollment"),
        limit: z.number().optional().describe("Max contacts to enroll (default 500)"),
      },
    },
    ({ workspaceId, sequenceId, filters, limit }) => {
      const payload: Record<string, unknown> = { filters };
      if (limit !== undefined) payload.limit = limit;
      return handleTool(() => client.mcPost(enrollPath(workspaceId, sequenceId), payload));
    },
  );

  server.registerTool(
    "remove_enrollments",
    {
      description: "Remove contacts from a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        filters: z
          .object({
            leadIds: z.array(z.string()).optional().describe("Lead/contact IDs to remove"),
            tagIds: z.array(z.string()).optional().describe("Tag IDs to filter"),
          })
          .describe("Filters to select contacts for removal"),
      },
    },
    ({ workspaceId, sequenceId, filters }) =>
      handleTool(() => client.mcPost(`${enrollPath(workspaceId, sequenceId)}/remove`, { filters })),
  );
}
