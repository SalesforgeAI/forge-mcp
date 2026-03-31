#!/usr/bin/env node

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SalesforgeClient } from "./client.js";
import { ApiClient } from "./api-client.js";
import { createServer, ProductClients } from "./server.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/mcp", (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, mcp-protocol-version, X-Salesforge-Key, X-Primeforge-Key, X-Leadsforge-Key, X-Infraforge-Key, X-Warmforge-Key, X-Mailforge-Key",
  );
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.all("/mcp", async (req, res) => {
  const sfKey = req.headers["x-salesforge-key"] as string | undefined;
  const pfKey = req.headers["x-primeforge-key"] as string | undefined;
  const lfKey = req.headers["x-leadsforge-key"] as string | undefined;
  const ifKey = req.headers["x-infraforge-key"] as string | undefined;
  const wfKey = req.headers["x-warmforge-key"] as string | undefined;
  const mfKey = req.headers["x-mailforge-key"] as string | undefined;

  if (!sfKey && !pfKey && !lfKey && !ifKey && !wfKey && !mfKey) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "At least one product API key header is required" },
      id: null,
    });
    return;
  }

  const clients: ProductClients = {};
  if (sfKey) clients.salesforge = new SalesforgeClient(sfKey);
  if (pfKey) clients.primeforge = new ApiClient(pfKey, "https://api.primeforge.ai/public", "PrimeForge");
  if (lfKey) clients.leadsforge = new ApiClient(lfKey, "https://api.leadsforge.ai/public/v1", "LeadsForge");
  if (ifKey) clients.infraforge = new ApiClient(ifKey, "https://api.infraforge.ai/public", "InfraForge");
  if (wfKey) clients.warmforge = new ApiClient("Bearer " + wfKey, "https://api.warmforge.ai/public/v1", "WarmForge");
  if (mfKey) clients.mailforge = new ApiClient(mfKey, "https://api.mailforge.ai/public", "MailForge");

  try {
    const server = createServer(clients);
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await transport.close();
    await server.close();
  } catch (e: unknown) {
    if (!res.headersSent) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: msg },
        id: null,
      });
    }
  }
});

const port = parseInt(process.env.PORT ?? "3000", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`Forge MCP server listening on http://0.0.0.0:${port}/mcp`);
});
