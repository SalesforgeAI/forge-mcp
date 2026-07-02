import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

function seqPath(workspaceId: string, sequenceId?: string) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/sequences`;
  return sequenceId ? `${base}/${enc(sequenceId)}` : base;
}

function subsequenceTriggersPath(workspaceId: string, subsequenceId: string) {
  return `/multichannel/workspaces/${enc(workspaceId)}/subsequences/${enc(subsequenceId)}/triggers`;
}

export function registerSubsequenceTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "create_subsequence",
    {
      description:
        "Create a subsequence and attach it to a parent sequence. Subsequences are follow-up flows triggered when a contact receives a Primebox label after replying to the parent sequence. This creates the subsequence, assigns it to the parent, and adds a label trigger in one step. After creation, add action nodes (create_action_node) and configure sender profiles before launching.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        parentSequenceId: z.string().describe("Parent sequence ID to attach this subsequence to"),
        name: z.string().describe("Subsequence name"),
        labelId: z.string().describe("Primebox label ID that triggers this subsequence when applied to a replying contact"),
        description: z.string().optional().describe("Subsequence description"),
        timezone: z.string().optional().describe("IANA timezone (e.g. America/New_York)"),
        priority: z.number().int().optional().describe("Assignment/trigger priority (default 0)"),
      },
    },
    ({ workspaceId, parentSequenceId, name, labelId, description, timezone, priority }) =>
      handleTool(async () => {
        const subsequence = await client.mcPost<{ id: number }>(seqPath(workspaceId), {
          name,
          kind: "subsequence",
          ...(description !== undefined && { description }),
          ...(timezone !== undefined && { timezone }),
        });

        const assignment = await client.mcPost(
          `${seqPath(workspaceId, parentSequenceId)}/subsequence-assignments`,
          {
            childSequenceId: subsequence.id,
            ...(priority !== undefined && { priority }),
          },
        );

        const trigger = await client.mcPost(subsequenceTriggersPath(workspaceId, String(subsequence.id)), {
          labelId,
          ...(priority !== undefined && { priority }),
        });

        return { subsequence, assignment, trigger };
      }),
  );

  server.registerTool(
    "assign_subsequence",
    {
      description:
        "Attach an existing subsequence to a parent sequence. The subsequence must have kind=subsequence. Use create_subsequence to create and attach in one step, or use this to link an existing subsequence.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        parentSequenceId: z.string().describe("Parent sequence ID"),
        childSequenceId: z.number().int().describe("Subsequence ID to attach"),
        priority: z.number().int().optional().describe("Assignment priority (default 0)"),
      },
    },
    ({ workspaceId, parentSequenceId, childSequenceId, priority }) =>
      handleTool(() =>
        client.mcPost(`${seqPath(workspaceId, parentSequenceId)}/subsequence-assignments`, {
          childSequenceId,
          ...(priority !== undefined && { priority }),
        }),
      ),
  );

  server.registerTool(
    "create_subsequence_trigger",
    {
      description:
        "Add a Primebox label trigger to a subsequence. When a contact in the parent sequence receives this label, they enter the subsequence.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        subsequenceId: z.string().describe("Subsequence ID"),
        labelId: z.string().describe("Primebox label ID"),
        priority: z.number().int().optional().describe("Trigger priority (default 0)"),
      },
    },
    ({ workspaceId, subsequenceId, labelId, priority }) =>
      handleTool(() =>
        client.mcPost(subsequenceTriggersPath(workspaceId, subsequenceId), {
          labelId,
          ...(priority !== undefined && { priority }),
        }),
      ),
  );

  server.registerTool(
    "list_subsequence_triggers",
    {
      description: "List all label triggers configured for a subsequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        subsequenceId: z.string().describe("Subsequence ID"),
      },
    },
    ({ workspaceId, subsequenceId }) =>
      handleTool(() => client.mcGet(subsequenceTriggersPath(workspaceId, subsequenceId))),
  );
}
