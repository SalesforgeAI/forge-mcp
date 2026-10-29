import assert from "node:assert/strict";
import test from "node:test";

test("product API URLs can point at another environment", async () => {
  process.env.SALESFORGE_API_URL = "https://api-dev.salesforge.ai/public/v2";
  process.env.SALESFORGE_MULTICHANNEL_API_URL = "https://multichannel-api-dev.salesforge.ai/public";
  process.env.PRIMEFORGE_API_URL = "https://api-dev.primeforge.ai/public";
  // Imported after the variables are set, since the Salesforge client reads them once.
  const { buildProductClients } = await import("../src/product-clients.js");

  const requested: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response("{}", { status: 200 });
  };
  try {
    const clients = buildProductClients({ salesforge: "sf-key", primeforge: "pf-key", mailforge: "mf-key" });
    await clients.salesforge!.coreGet("/workspaces");
    await clients.salesforge!.mcGet("/multichannel/workspaces");
    await clients.primeforge!.get("/workspaces");
    await clients.mailforge!.get("/workspaces");
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.deepEqual(requested.map((url) => new URL(url).origin + new URL(url).pathname), [
    "https://api-dev.salesforge.ai/public/v2/workspaces",
    "https://multichannel-api-dev.salesforge.ai/public/multichannel/workspaces",
    "https://api-dev.primeforge.ai/public/workspaces",
    "https://api.mailforge.ai/public/workspaces",
  ]);
});
