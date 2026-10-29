import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, ProductClients } from "./server.js";
import { errorFields, log, requestLogging } from "./logging.js";
import { InvalidTokenError, type ResourceServer } from "./oauth/resource-server.js";
import { buildProductClients } from "./product-clients.js";
import { PRODUCTS } from "./products.js";

const CORS_ALLOW_HEADERS = ["Content-Type", "Authorization", "Mcp-Session-Id", "mcp-protocol-version",
  ...PRODUCTS.map((product) => `X-${product[0].toUpperCase()}${product.slice(1)}-Key`)].join(", ");

/** The token from an `Authorization: Bearer ...` header, if that is what was sent. */
function bearerToken(header: string | undefined): string | undefined {
  return header && /^bearer /i.test(header) ? header.slice(7).trim() : undefined;
}

/** The HTTP surface: /health, the protected resource metadata when `oauth` is given, and /mcp. */
export function createHttpApp(oauth?: ResourceServer): express.Express {
  const app = express();
  app.use(requestLogging);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (oauth) app.use(oauth.router);

  app.use("/mcp", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, WWW-Authenticate");
    res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // This stateless server does not send notifications on standalone SSE streams.
  app.get("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST, DELETE, OPTIONS");
    res.status(405).end();
  });

  /** A 401 that starts sign-in: with OAuth on, the challenge tells the client where to find the authorization server. */
  function unauthorized(res: Response, message: string, error?: "invalid_token"): void {
    if (oauth) res.setHeader("WWW-Authenticate", oauth.challenge(error));
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null });
  }

  /**
   * X-*-Key headers win whenever any is present, so header-key clients work exactly as before even if they also
   * send an Authorization header. Otherwise a bearer token takes the OAuth path and uses the managed keys the
   * issuer holds for its grant. Responds and returns undefined when the request can't be authenticated.
   */
  async function resolveClients(req: Request, res: Response): Promise<ProductClients | undefined> {
    const headerClients = buildProductClients(Object.fromEntries(
      PRODUCTS.map((product) => [product, req.headers[`x-${product}-key`] as string | undefined]),
    ));
    if (Object.keys(headerClients).length > 0) return headerClients;

    const token = bearerToken(req.headers.authorization);
    if (oauth && token) {
      const server = oauth;
      try {
        const credentials = await server.resolveBearer(token);
        const plaintext = Object.fromEntries(Object.entries(credentials).map(([product, credential]) => [product, credential.key]));
        const clients = buildProductClients(plaintext, (product) => {
          void server.reportRejected(token, product, credentials[product]!);
        });
        if (Object.keys(clients).length > 0) return clients;
        unauthorized(res, "This connection no longer has access to any product; reconnect to restore it", "invalid_token");
        return undefined;
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          unauthorized(res, "Invalid or expired access token", "invalid_token");
          return undefined;
        }
        throw error;
      }
    }

    unauthorized(res, oauth ? "Authorization required" : "At least one product API key header is required");
    return undefined;
  }

  app.all("/mcp", async (req, res) => {
    let clients: ProductClients | undefined;
    try {
      clients = await resolveClients(req, res);
    } catch (error) {
      log("error", "mcp.auth.failed", errorFields(error));
      res.status(503).json({ jsonrpc: "2.0", error: { code: -32603, message: "Authorization is temporarily unavailable" }, id: null });
      return;
    }
    if (!clients) return;

    let stage = "create_server";
    const started = performance.now();
    let server: ReturnType<typeof createServer> | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    let cleanupPromise: Promise<void> | undefined;

    /** Close both resources once, including when disconnect and finally overlap. */
    const cleanup = (): Promise<void> => {
      cleanupPromise ??= Promise.resolve().then(async () => {
        try {
          await transport?.close();
        } catch (error) {
          log("error", "mcp.cleanup.failed", { resource: "transport", ...errorFields(error) });
        }
        try {
          await server?.close();
        } catch (error) {
          log("error", "mcp.cleanup.failed", { resource: "server", ...errorFields(error) });
        }
      });
      return cleanupPromise;
    };

    /** Release resources immediately when the client leaves before the response finishes. */
    const onClose = (): void => {
      if (!res.writableFinished) void cleanup();
    };
    res.once("close", onClose);
    try {
      if (res.destroyed) return;
      server = createServer(clients);
      log("debug", "mcp.server.created", { durationMs: Math.round(performance.now() - started), products: Object.keys(clients) });
      transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

      stage = "connect";
      await server.connect(transport);
      if (res.destroyed) return;
      log("debug", "mcp.transport.connected", { durationMs: Math.round(performance.now() - started) });
      stage = "handle_request";
      await transport.handleRequest(req, res, req.body);
      log("info", "mcp.request.completed", { durationMs: Math.round(performance.now() - started) });
    } catch (e: unknown) {
      log("error", "mcp.request.failed", { stage, ...errorFields(e), headersSent: res.headersSent, durationMs: Math.round(performance.now() - started) });
      if (!res.headersSent && !res.destroyed) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: msg },
          id: null,
        });
      } else if (!res.writableEnded && !res.destroyed) {
        res.destroy();
      }
    } finally {
      await cleanup();
      res.off("close", onClose);
    }
  });

  /** Log parsing and Express errors while preserving the default error response handling. */
  const logExpressError: ErrorRequestHandler = (error, _req, _res, next) => {
    log("error", "http.request.failed", errorFields(error));
    next(error);
  };
  app.use(logExpressError);
  return app;
}
