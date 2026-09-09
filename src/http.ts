#!/usr/bin/env node

import express, { type ErrorRequestHandler } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SalesforgeClient } from "./client.js";
import { ApiClient } from "./api-client.js";
import { createServer, ProductClients } from "./server.js";
import { errorFields, log, requestLogging, startRuntimeLogging } from "./logging.js";

const app = express();
app.use(requestLogging);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/mcp", (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
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

  let stage = "create_server";
  const started = performance.now();
  try {
    const server = createServer(clients);
    log("debug", "mcp.server.created", { durationMs: Math.round(performance.now() - started), products: Object.keys(clients) });
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

    stage = "connect";
    await server.connect(transport);
    log("debug", "mcp.transport.connected", { durationMs: Math.round(performance.now() - started) });
    stage = "handle_request";
    await transport.handleRequest(req, res, req.body);
    stage = "close_transport";
    await transport.close();
    stage = "close_server";
    await server.close();
    log("info", "mcp.request.completed", { durationMs: Math.round(performance.now() - started) });
  } catch (e: unknown) {
    log("error", "mcp.request.failed", { stage, ...errorFields(e), headersSent: res.headersSent, durationMs: Math.round(performance.now() - started) });
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

/** Log parsing and Express errors while preserving the default error response handling. */
const logExpressError: ErrorRequestHandler = (error, _req, _res, next) => {
  log("error", "http.request.failed", errorFields(error));
  next(error);
};
app.use(logExpressError);

const stopRuntimeLogging = startRuntimeLogging();
process.on("uncaughtExceptionMonitor", (error, origin) => {
  log("error", "process.uncaught_exception", { ...errorFields(error), origin });
});
process.on("warning", (warning) => {
  log("warn", "process.warning", errorFields(warning));
});

const port = parseInt(process.env.PORT ?? "3000", 10);
const httpServer = app.listen(port, "0.0.0.0");
httpServer.once("listening", () => {
  log("info", "http.server.listening", {
    port: (httpServer.address() as { port: number }).port, host: "0.0.0.0", nodeVersion: process.version,
    requestTimeoutMs: httpServer.requestTimeout, headersTimeoutMs: httpServer.headersTimeout,
    keepAliveTimeoutMs: httpServer.keepAliveTimeout,
  });
});
httpServer.on("error", (error) => {
  log("error", "http.server.error", errorFields(error));
  stopRuntimeLogging();
  process.exitCode = 1;
});
httpServer.on("close", () => {
  stopRuntimeLogging();
  log("info", "http.server.closed");
});
