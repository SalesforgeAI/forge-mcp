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
      description: "Create an action node (email, LinkedIn message, connection request, etc.) in a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        action: z.record(z.string(), z.any()).describe("Action node config (type, content, delay, etc.)"),
      },
    },
    ({ workspaceId, sequenceId, action }) =>
      handleTool(() => client.mcPost(`${nodesPath(workspaceId, sequenceId)}/actions`, action)),
  );

  server.registerTool(
    "update_action_node",
    {
      description: "Update an existing action node",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        nodeId: z.string().describe("Node ID"),
        action: z.record(z.string(), z.any()).describe("Updated action node config"),
      },
    },
    ({ workspaceId, sequenceId, nodeId, action }) =>
      handleTool(() => client.mcPatch(`${nodesPath(workspaceId, sequenceId)}/actions/${enc(nodeId)}`, action)),
  );

  server.registerTool(
    "create_condition_node",
    {
      description: "Create a condition node (branching logic) in a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
        condition: z.record(z.string(), z.any()).describe("Condition node config"),
      },
    },
    ({ workspaceId, sequenceId, condition }) =>
      handleTool(() => client.mcPost(`${nodesPath(workspaceId, sequenceId)}/conditions`, condition)),
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
