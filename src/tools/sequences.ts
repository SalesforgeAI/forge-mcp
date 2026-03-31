import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

function seqPath(workspaceId: string, sequenceId?: string) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/sequences`;
  return sequenceId ? `${base}/${enc(sequenceId)}` : base;
}

export function registerSequenceTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sequences",
    {
      description: "List multichannel sequences (email + LinkedIn) in a workspace. These have numeric IDs. For legacy email-only sequences (IDs prefixed with seq_), use the core API.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        limit: z.number().optional().describe("Max results"),
        offset: z.number().optional().describe("Offset"),
      },
    },
    ({ workspaceId, limit, offset }) =>
      handleTool(() => client.mcGet(seqPath(workspaceId), buildQuery({ limit, offset }))),
  );

  server.registerTool(
    "create_sequence",
    {
      description: "Create a new multichannel sequence (supports email + LinkedIn channels)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        name: z.string().describe("Sequence name"),
        description: z.string().optional().describe("Sequence description"),
        timezone: z.string().optional().describe("IANA timezone (e.g. America/New_York)"),
      },
    },
    ({ workspaceId, ...body }) =>
      handleTool(() => client.mcPost(seqPath(workspaceId), body)),
  );

  server.registerTool(
    "get_sequence",
    {
      description: "Get multichannel sequence details by numeric ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(seqPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "update_sequence",
    {
      description: "Update a multichannel sequence (name, description, timezone)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
        timezone: z.string().optional().describe("New IANA timezone"),
      },
    },
    ({ workspaceId, sequenceId, ...body }) =>
      handleTool(() => client.mcPatch(seqPath(workspaceId, sequenceId), body)),
  );

  server.registerTool(
    "delete_sequence",
    {
      description: "Delete a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcDelete(seqPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "launch_sequence",
    {
      description: "Activate/launch a multichannel sequence (must have nodes and sender profiles configured)",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/launch`, {})),
  );

  server.registerTool(
    "set_sequence_status",
    {
      description: "Pause or activate a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        status: z.enum(["active", "paused"]).describe("New status"),
      },
    },
    ({ workspaceId, sequenceId, status }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/status`, { status })),
  );

  server.registerTool(
    "get_sequence_schedule",
    {
      description: "Get the sending schedule for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(`${seqPath(workspaceId, sequenceId)}/schedule`)),
  );

  server.registerTool(
    "update_sequence_schedule",
    {
      description: "Update the sending schedule for a multichannel sequence. Each day has enabled (boolean), from (hour 0-23), and to (hour 0-23).",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        timezone: z.string().describe("IANA timezone string (e.g. 'America/New_York', 'Asia/Kolkata')"),
        schedule: z.object({
          monday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          tuesday:   z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          wednesday: z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          thursday:  z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          friday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          saturday:  z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
          sunday:    z.object({ enabled: z.boolean(), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).optional(),
        }).describe("Schedule per day of week"),
      },
    },
    ({ workspaceId, sequenceId, timezone, schedule }) =>
      handleTool(() => client.mcPut(`${seqPath(workspaceId, sequenceId)}/schedule`, { timezone, schedule })),
  );

  server.registerTool(
    "get_sequence_settings",
    {
      description: "Get settings for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(`${seqPath(workspaceId, sequenceId)}/settings`)),
  );

  server.registerTool(
    "update_sequence_settings",
    {
      description: "Update settings for a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        settings: z.record(z.string(), z.any()).describe("Settings object"),
      },
    },
    ({ workspaceId, sequenceId, settings }) =>
      handleTool(() => client.mcPatch(`${seqPath(workspaceId, sequenceId)}/settings`, settings)),
  );
}
