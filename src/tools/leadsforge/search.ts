import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api-client.js";
import { handleTool } from "../../helpers.js";

export function registerLeadsforgeSearchTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "leadsforge_get_balance",
    {
      description: "Get LeadsForge credit balance",
      inputSchema: {},
    },
    () => handleTool(() => client.get("/balance")),
  );

  server.registerTool(
    "leadsforge_search",
    {
      description: "Search for leads in LeadsForge",
      inputSchema: {
        filters: z.record(z.string(), z.any()).describe("Search filters (name, title, company, location, etc.)"),
        limit: z.number().optional().describe("Max results (1-2000)"),
        cursor: z.string().optional().describe("Pagination cursor from previous response"),
      },
    },
    ({ filters, limit, cursor }) =>
      handleTool(() => client.post("/search", { ...filters, limit, cursor })),
  );
}
