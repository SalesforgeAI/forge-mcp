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
  const profile = z.object({
    name: z.string().min(1),
    mailboxIds: z.array(z.string()).optional().describe("Existing mailbox IDs in this workspace"),
    linkedinAccountId: z.number().int().positive().optional().describe("Existing LinkedIn account ID in this workspace, not already attached to a profile"),
  });
  server.registerTool("create_sender_profile", {
    description: "Create a sender profile, optionally attaching existing mailboxes and/or a LinkedIn account connected with skipSenderProfile=true.",
    inputSchema: { workspaceId: z.string().min(1), ...profile.shape },
  }, ({ workspaceId, ...body }) => handleTool(() => client.mcPost(profilesPath(workspaceId), body)));

  server.registerTool("bulk_create_sender_profiles", {
    description: "Create 1–100 sender profiles. Entries are processed independently; inspect each result for success or failure.",
    inputSchema: { workspaceId: z.string().min(1), profiles: z.array(profile).min(1).max(100) },
  }, ({ workspaceId, profiles }) =>
    handleTool(() => client.mcPost(`${profilesPath(workspaceId)}/bulk`, { profiles })));

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
      description: "Delete a sender profile and its attached LinkedIn account, if any.",
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
