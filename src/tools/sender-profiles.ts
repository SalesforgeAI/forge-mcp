import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

function profilesPath(workspaceId: string, profileId?: string) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/sender-profiles`;
  return profileId ? `${base}/${enc(profileId)}` : base;
}

function seqProfilesPath(workspaceId: string, sequenceId: string) {
  return `/multichannel/workspaces/${enc(workspaceId)}/sequences/${enc(sequenceId)}/sender-profiles`;
}

export function registerSenderProfileTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sender_profiles",
    {
      description: "List all sender profiles in a workspace",
      inputSchema: { workspaceId: z.string().describe("Workspace ID") },
    },
    ({ workspaceId }) => handleTool(() => client.mcGet(profilesPath(workspaceId))),
  );

  server.registerTool(
    "update_sender_profile",
    {
      description: "Update a sender profile",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        senderProfileId: z.string().describe("Sender profile ID"),
        updates: z.record(z.string(), z.any()).describe("Fields to update"),
      },
    },
    ({ workspaceId, senderProfileId, updates }) =>
      handleTool(() => client.mcPatch(profilesPath(workspaceId, senderProfileId), updates)),
  );

  server.registerTool(
    "delete_sender_profile",
    {
      description: "Delete a sender profile",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        senderProfileId: z.string().describe("Sender profile ID"),
      },
    },
    ({ workspaceId, senderProfileId }) =>
      handleTool(() => client.mcDelete(profilesPath(workspaceId, senderProfileId))),
  );

  server.registerTool(
    "list_sequence_sender_profiles",
    {
      description: "List sender profiles assigned to a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(seqProfilesPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "assign_sender_profiles_to_sequence",
    {
      description: "Assign sender profiles to a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        senderProfileIds: z.array(z.number().int()).min(1).describe("Sender profile IDs (integers) to assign"),
      },
    },
    ({ workspaceId, sequenceId, senderProfileIds }) =>
      handleTool(() => client.mcPost(seqProfilesPath(workspaceId, sequenceId), { senderProfileIds })),
  );

  server.registerTool(
    "remove_sender_profiles_from_sequence",
    {
      description: "Remove sender profiles from a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        senderProfileIds: z.array(z.number().int()).min(1).max(50).describe("Sender profile IDs (integers) to remove"),
      },
    },
    ({ workspaceId, sequenceId, senderProfileIds }) =>
      handleTool(() =>
        client.mcPost(`${seqProfilesPath(workspaceId, sequenceId)}/remove`, { senderProfileIds }),
      ),
  );
}
