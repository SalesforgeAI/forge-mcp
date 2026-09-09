import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import type { RequestHandler } from "express";

type Level = "debug" | "info" | "warn" | "error";
const levels: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = process.env.LOG_LEVEL ?? "info";
const minimumLevel = levels[configuredLevel as Level] ?? levels.info;
const context = new AsyncLocalStorage<{ requestId: string }>();

/** Read a positive millisecond setting, falling back for invalid values. */
function milliseconds(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 && value <= 2_147_483_647 ? value : fallback;
}

const slowRequestMs = milliseconds("SLOW_REQUEST_MS", 3000);

/** Write structured diagnostics to stderr without interfering with MCP stdio. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (levels[level] < minimumLevel) return;
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, event, pid: process.pid,
    ...context.getStore(), ...fields,
  }) + "\n");
}

/** Extract safe error metadata; messages and stacks can contain upstream payloads or URLs. */
export function errorFields(error: unknown): Record<string, unknown> {
  const value = error as { name?: unknown; code?: unknown; statusCode?: unknown; cause?: { code?: unknown } } | null;
  return {
    errorType: typeof value?.name === "string" ? value.name : typeof error,
    errorCode: typeof value?.code === "string" ? value.code :
      typeof value?.cause?.code === "string" ? value.cause.code : undefined,
    statusCode: typeof value?.statusCode === "number" ? value.statusCode : undefined,
  };
}

let activeRequests = 0;

/** Trace requests before body parsing, including stalled bodies and disconnected clients. */
export const requestLogging: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  context.run({ requestId }, () => {
    const started = performance.now();
    // Only known routes are recorded; arbitrary paths may contain personal data.
    const route = req.path === "/health" || req.path === "/mcp" ? req.path : "other";
    const fields = { requestId, method: req.method, route };
    activeRequests++;
    res.setHeader("X-Request-Id", requestId);
    log("info", "http.request.started", fields);
    const slowTimer = setTimeout(() => {
      log("warn", "http.request.slow", { ...fields, durationMs: Math.round(performance.now() - started) });
    }, slowRequestMs);
    slowTimer.unref();
    let finished = false;
    /** Record exactly one terminal event and release request accounting. */
    const finish = (aborted: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(slowTimer);
      activeRequests--;
      log(aborted || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        aborted ? "http.request.aborted" : "http.request.completed", {
          ...fields, statusCode: res.statusCode, durationMs: Math.round(performance.now() - started), activeRequests,
        });
    };
    res.once("finish", () => finish(false));
    res.once("close", () => finish(!res.writableFinished));
    next();
  });
};

/** Trace upstream requests through body consumption, preserving response and error behavior. */
export async function loggedFetch<T>(
  product: string,
  url: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const fields = { upstreamRequestId: randomUUID(), product, host: new URL(url).host, method: init.method ?? "GET" };
  let statusCode: number | undefined;
  log("info", "upstream.request.started", fields);
  const slowTimer = setTimeout(() => {
    log("warn", "upstream.request.slow", { ...fields, statusCode, durationMs: Math.round(performance.now() - started) });
  }, slowRequestMs);
  slowTimer.unref();
  try {
    const response = await fetch(url, init);
    statusCode = response.status;
    log("debug", "upstream.response.headers", { ...fields, statusCode, durationMs: Math.round(performance.now() - started) });
    const result = await consume(response);
    log("info", "upstream.request.completed", { ...fields, statusCode, durationMs: Math.round(performance.now() - started) });
    return result;
  } catch (error) {
    log("error", "upstream.request.failed", { ...fields, ...errorFields(error), statusCode, durationMs: Math.round(performance.now() - started) });
    throw error;
  } finally {
    clearTimeout(slowTimer);
  }
}

/** Sample process health so event-loop stalls and resource pressure can be correlated with requests. */
export function startRuntimeLogging(): () => void {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let previousUtilization = performance.eventLoopUtilization();
  let previousCpu = process.cpuUsage();
  let previousTime = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    const utilization = performance.eventLoopUtilization();
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    const maxDelayMs = Number.isFinite(delay.max) ? Math.round(delay.max / 1e6) : 0;
    log(maxDelayMs >= slowRequestMs ? "warn" : "info", "runtime.metrics", {
      uptimeSeconds: Math.round(process.uptime()), activeRequests,
      sampleDurationMs: Math.round(now - previousTime),
      eventLoopDelayMaxMs: maxDelayMs, eventLoopDelayP99Ms: Math.round(delay.percentile(99) / 1e6),
      eventLoopUtilization: performance.eventLoopUtilization(utilization, previousUtilization).utilization,
      cpuPercent: Math.round((cpu.user - previousCpu.user + cpu.system - previousCpu.system) / ((now - previousTime) * 10)),
      rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, externalBytes: memory.external,
    });
    previousTime = now;
    previousCpu = cpu;
    previousUtilization = utilization;
    delay.reset();
  }, milliseconds("RUNTIME_LOG_INTERVAL_MS", 10000));
  timer.unref();
  return () => { clearInterval(timer); delay.disable(); };
}
