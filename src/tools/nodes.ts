import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

function nodesPath(workspaceId: string, sequenceId: string, nodeId?: string) {
  const base = `/multichannel/workspaces/${enc(workspaceId)}/sequences/${enc(sequenceId)}/nodes`;
  return nodeId ? `${base}/${enc(nodeId)}` : base;
}

export function registerNodeTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sequence_nodes",
    {
      description: "List all nodes (workflow steps) in a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() => client.mcGet(nodesPath(workspaceId, sequenceId))),
  );

  server.registerTool(
    "get_sequence_node",
    {
      description: "Get a specific node by ID",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        nodeId: z.string().describe("Node ID"),
      },
    },
    ({ workspaceId, sequenceId, nodeId }) =>
      handleTool(() => client.mcGet(nodesPath(workspaceId, sequenceId, nodeId))),
  );

  server.registerTool(
    "create_action_node",
    {
      description: "Create an action node (email, LinkedIn message, connection request, etc.) in a multichannel sequence. IMPORTANT: branchId is required — get it from list_sequence_branches or list_sequence_nodes (branches array). Delay is set via waitDays (integer, days to wait before executing this node).",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        branchId: z.number().int().describe("ID of the branch this node attaches to (required). Get from list_sequence_branches or the branches array in list_sequence_nodes."),
        actionId: z.number().int().describe("Action type ID (get from list_action_types): 1=li_connection_request, 2=li_send_message, 3=send_email, 4=li_view_profile, 5=li_withdraw_connection_request, 6=li_like_latest_post, 7=li_follow_profile, 8=li_send_inmail"),
        waitDays: z.number().int().min(0).optional().describe("Number of days to wait before executing this node (default 0)"),
        variants: z.array(z.object({
          metadata: z.object({
            subject: z.string().optional().describe("Email subject line (for send_email action)"),
            message: z.string().optional().describe("Message body / email body"),
            name: z.string().optional().describe("Variant name"),
          }),
          exposureInPercentage: z.number().int().min(0).max(100).describe("Traffic percentage for this variant (all variants must sum to 100)"),
          isEnabled: z.boolean().optional().describe("Whether this variant is enabled"),
        })).optional().describe("Message variants (A/B test splits). exposureInPercentage values must sum to 100."),
        distributionStrategy: z.enum(["equal", "custom"]).optional().describe("How to distribute traffic across variants"),
      },
    },
    ({ workspaceId, sequenceId, branchId, actionId, waitDays, variants, distributionStrategy }) =>
      handleTool(() => client.mcPost(`${nodesPath(workspaceId, sequenceId)}/actions`, {
        branchId,
        actionId,
        ...(waitDays !== undefined && { waitDays }),
        ...(variants !== undefined && { variants }),
        ...(distributionStrategy !== undefined && { distributionStrategy }),
      })),
  );

  server.registerTool(
    "update_action_node",
    {
      description: "Update an existing action node's message content or delay. Delay is set via wait_in_minutes (integer minutes). To update message copy, pass variants with metadata containing subject and message.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        nodeId: z.string().describe("Node ID"),
        wait_in_minutes: z.number().int().min(0).optional().describe("Minutes to wait before executing this node (e.g. 1440 = 1 day, 2880 = 2 days)"),
        variants: z.array(z.object({
          id: z.number().int().optional().describe("Variant ID (required when updating an existing variant; omit only when adding a new variant)"),
          metadata: z.object({
            subject: z.string().optional().describe("Email subject line (for send_email action)"),
            message: z.string().optional().describe("Message body / email body"),
            name: z.string().optional().describe("Variant name"),
          }),
          exposureInPercentage: z.number().int().min(0).max(100).describe("Traffic percentage for this variant (all variants must sum to 100)"),
          isEnabled: z.boolean().optional().describe("Whether this variant is enabled"),
        })).optional().describe("Message variants. Include id of existing variants. exposureInPercentage values must sum to 100."),
        distributionStrategy: z.enum(["equal", "custom"]).optional().describe("How to distribute traffic across variants"),
      },
    },
    ({ workspaceId, sequenceId, nodeId, wait_in_minutes, variants, distributionStrategy }) =>
      handleTool(() => client.mcPatch(`${nodesPath(workspaceId, sequenceId)}/actions/${enc(nodeId)}`, {
        ...(wait_in_minutes !== undefined && { wait_in_minutes }),
        ...(variants !== undefined && { variants }),
        ...(distributionStrategy !== undefined && { distributionStrategy }),
      })),
  );

  server.registerTool(
    "create_condition_node",
    {
      description: "Create a condition node (branching logic) in a multichannel sequence. IMPORTANT: branchId is required.",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        branchId: z.number().int().describe("ID of the branch this node attaches to (required). Get from list_sequence_branches or the branches array in list_sequence_nodes."),
        conditionId: z.number().int().describe("Condition type ID (get from list_condition_types)"),
        minutesToWait: z.number().int().min(0).optional().describe("Minutes to wait before evaluating this condition"),
        distributionStrategy: z.enum(["equal", "custom"]).optional().describe("Distribution strategy"),
      },
    },
    ({ workspaceId, sequenceId, branchId, conditionId, minutesToWait, distributionStrategy }) =>
      handleTool(() => client.mcPost(`${nodesPath(workspaceId, sequenceId)}/conditions`, {
        branchId,
        conditionId,
        ...(minutesToWait !== undefined && { minutesToWait }),
        ...(distributionStrategy !== undefined && { distributionStrategy }),
      })),
  );

  server.registerTool(
    "delete_sequence_node",
    {
      description: "Delete a node from a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        nodeId: z.string().describe("Node ID"),
      },
    },
    ({ workspaceId, sequenceId, nodeId }) =>
      handleTool(() => client.mcDelete(nodesPath(workspaceId, sequenceId, nodeId))),
  );
}
