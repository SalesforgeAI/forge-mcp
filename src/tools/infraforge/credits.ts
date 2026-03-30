import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

export function registerInfraforgeCreditTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "infraforge_get_credit_balance",
    {
      description: "Get InfraForge credit balance",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/credits/balance")),
  );

  server.registerTool(
    "infraforge_create_credit_balance",
    {
      description: "Create/top up InfraForge credit balance",
      inputSchema: {
        amount: z.number().describe("Amount in cents (min 100)"),
        isEnabled: z.boolean().describe("Enable auto top-up"),
        topupThreshold: z.number().describe("Threshold for auto top-up (min 50)"),
      },
    },
    (body) => handleTool(() => client.post("/credits/balance", body)),
  );

  server.registerTool(
    "infraforge_update_credit_balance",
    {
      description: "Update InfraForge credit balance settings",
      inputSchema: {
        amount: z.number().optional().describe("New amount (min 100)"),
        isEnabled: z.boolean().optional().describe("Enable/disable auto top-up"),
        topupThreshold: z.number().optional().describe("New threshold (min 50)"),
      },
    },
    (body) => handleTool(() => client.patch("/credits/balance", body)),
  );
}
