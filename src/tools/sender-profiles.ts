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

const mailboxFilter = z.object({
  ids: z.array(z.string().min(1)).optional().describe("Mailbox IDs to include. With tagIds, only the mailboxes in this list that also have one of the tags are selected"),
  tagIds: z.array(z.string().min(1)).optional().describe("Mailbox tag IDs from list_mailbox_tags. Selects mailboxes with at least one of these tags"),
  limit: z.number().int().min(1).max(1000).optional().describe("Max mailboxes to select, 1-1000. Omit to select every match"),
  sampling: z.enum(["normal", "random"]).optional().describe("How limit picks mailboxes. normal (default) picks the same mailboxes on every call. random picks a new random set on each call and requires limit"),
}).strict().refine((filter) => filter.sampling !== "random" || filter.limit !== undefined, {
  message: "sampling random requires limit",
  path: ["sampling"],
}).describe(
  "Selects existing workspace mailboxes on the server. A mailbox must match every field that is set. " +
  "With tagIds or limit, only active mailboxes are selected. Each call selects on its own, so two profiles can get the same mailbox. " +
  "Example: {tagIds:[tagId], limit:500, sampling:\"random\"}.",
);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * withoutMailboxes drops the embedded mailbox list from a sender profile response. A filter can attach
 * many mailboxes, and mailboxCount already tells the caller how many there are.
 */
function withoutMailboxes(profile: unknown): unknown {
  if (!isObject(profile)) return profile;
  const { mailboxes: _mailboxes, ...rest } = profile;
  return rest;
}

/** withoutResultMailboxes applies withoutMailboxes to each profile of a bulk create response. */
function withoutResultMailboxes(response: unknown): unknown {
  if (!isObject(response) || !Array.isArray(response.results)) return response;
  return {
    ...response,
    results: response.results.map((result) =>
      isObject(result) && "profile" in result ? { ...result, profile: withoutMailboxes(result.profile) } : result),
  };
}

export function registerSenderProfileTools(server: McpServer, client: SalesforgeClient) {
  const profile = z.object({
    name: z.string().min(1),
    mailboxFilter: mailboxFilter.optional(),
    linkedinAccountId: z.number().int().positive().optional().describe("Existing LinkedIn account ID in this workspace, not already attached to a profile"),
  }).strict();
  server.registerTool("create_sender_profile", {
    description: "Create a sender profile, optionally attaching existing mailboxes (mailboxFilter) and/or a LinkedIn account connected with skipSenderProfile=true. Returns the profile without its mailbox list; mailboxCount is the number of attached mailboxes.",
    inputSchema: z.object({ workspaceId: z.string().min(1), ...profile.shape }).strict(),
  }, ({ workspaceId, ...body }) =>
    handleTool(async () => withoutMailboxes(await client.mcPost(profilesPath(workspaceId), body))));

  server.registerTool("bulk_create_sender_profiles", {
    description: "Create 1–100 sender profiles. Entries are processed independently; inspect each result for success or failure. Each profile is returned without its mailbox list; mailboxCount is the number of attached mailboxes.",
    inputSchema: { workspaceId: z.string().min(1), profiles: z.array(profile).min(1).max(100) },
  }, ({ workspaceId, profiles }) =>
    handleTool(async () => withoutResultMailboxes(await client.mcPost(`${profilesPath(workspaceId)}/bulk`, { profiles }))));

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
      description:
        "Update a sender profile name or mailboxes, or attach an existing LinkedIn account to an unlinked profile. " +
        "Repeating the same account ID is allowed; replacing another account is rejected. Omitted fields remain unchanged. " +
        "Mailboxes are selected by updates.mailboxFilter and applied by mode: replace (default) or add. Omit mailboxFilter to keep the current mailboxes. " +
        "To add mailboxes to a profile that already has some, use mode add; replace drops the current mailboxes. " +
        "Returns the profile without its mailbox list: mailboxCount is the number attached, addedMailboxCount the number added in add mode.",
      inputSchema: z.object({
        workspaceId: z.string().describe("Workspace ID"),
        senderProfileId: z.string().describe("Sender profile ID"),
        mode: z.enum(["replace", "add"]).optional().describe("How updates.mailboxFilter is applied. replace (default) makes the selected mailboxes the profile's only mailboxes. add keeps the mailboxes already attached, adds the selected ones, and never selects a mailbox the profile already has"),
        updates: z.object({
          name: z.string().optional(),
          mailboxFilter: mailboxFilter.optional(),
          linkedinAccountId: z.number().int().positive().nullable().optional().describe("Existing unassigned account in this workspace; omitted or null leaves the association unchanged"),
        }).strict().describe("Fields to update"),
      }).strict(),
    },
    ({ workspaceId, senderProfileId, mode, updates }) =>
      handleTool(async () =>
        withoutMailboxes(await client.mcPatch(profilesPath(workspaceId, senderProfileId), { ...updates, mode }))),
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
