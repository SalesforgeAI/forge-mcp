#!/usr/bin/env node

import { createHttpApp } from "./app.js";
import { errorFields, log, startRuntimeLogging } from "./logging.js";
import { createResourceServer, loadResourceServerConfig, oauthEnabled } from "./oauth/resource-server.js";

// With OAUTH_ENABLED unset the server is exactly the header-key server it was.
const oauth = oauthEnabled() ? createResourceServer(loadResourceServerConfig()) : undefined;
const app = createHttpApp(oauth);

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
