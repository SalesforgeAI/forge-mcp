#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SalesforgeClient } from "./client.js";
import { ApiClient } from "./api-client.js";
import { createServer, ProductClients } from "./server.js";

function buildClients(): ProductClients {
  const clients: ProductClients = {};

  const sfKey = process.env.SALESFORGE_API_KEY;
  if (sfKey) clients.salesforge = new SalesforgeClient(sfKey);

  const pfKey = process.env.PRIMEFORGE_API_KEY;
  if (pfKey) clients.primeforge = new ApiClient(pfKey, "https://api.primeforge.ai/public", "PrimeForge");

  const lfKey = process.env.LEADSFORGE_API_KEY;
  if (lfKey) clients.leadsforge = new ApiClient(lfKey, "https://api.leadsforge.ai/public/v1", "LeadsForge");

  const ifKey = process.env.INFRAFORGE_API_KEY;
  if (ifKey) clients.infraforge = new ApiClient(ifKey, "https://api.infraforge.ai/public", "InfraForge");

  return clients;
}

async function main() {
  const clients = buildClients();

  if (!clients.salesforge && !clients.primeforge && !clients.leadsforge && !clients.infraforge) {
    console.error("Error: At least one API key is required. Set SALESFORGE_API_KEY, PRIMEFORGE_API_KEY, LEADSFORGE_API_KEY, or INFRAFORGE_API_KEY.");
    process.exit(1);
  }

  const products = Object.keys(clients).filter((k) => clients[k as keyof ProductClients]);
  console.error(`Forge MCP server starting with: ${products.join(", ")}`);

  const server = createServer(clients);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
