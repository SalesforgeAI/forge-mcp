#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PRODUCTS } from "./products.js";
import { buildProductClients } from "./product-clients.js";
import { createServer, ProductClients } from "./server.js";

function buildClients(): ProductClients {
  return buildProductClients(Object.fromEntries(
    PRODUCTS.map((product) => [product, process.env[`${product.toUpperCase()}_API_KEY`]]),
  ));
}

async function main() {
  const clients = buildClients();

  if (!clients.salesforge && !clients.primeforge && !clients.leadsforge && !clients.infraforge && !clients.warmforge && !clients.mailforge) {
    console.error("Error: At least one API key is required. Set SALESFORGE_API_KEY, PRIMEFORGE_API_KEY, LEADSFORGE_API_KEY, INFRAFORGE_API_KEY, WARMFORGE_API_KEY, or MAILFORGE_API_KEY.");
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
