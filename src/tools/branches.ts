import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc } from "../helpers.js";

export function registerBranchTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool(
    "list_sequence_branches",
    {
      description: "List all branches in a multichannel sequence",
      inputSchema: {
        workspaceId: z.string().describe("Workspace ID"),
        sequenceId: z.string().describe("Sequence ID"),
      },
    },
    ({ workspaceId, sequenceId }) =>
      handleTool(() =>
        client.mcGet(`/multichannel/workspaces/${enc(workspaceId)}/sequences/${enc(sequenceId)}/branches`),
      ),
  );
}
