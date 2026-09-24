import assert from "node:assert/strict";
import test from "node:test";
import { SalesforgeClient } from "../src/client.js";

test("local Salesforge requests use IPv4 loopback", async () => {
  const originalFetch = globalThis.fetch;
  const requestedURLs: string[] = [];

  globalThis.fetch = async (input) => {
    requestedURLs.push(String(input));
    return new Response("{}", { status: 200 });
  };

  try {
    const client = new SalesforgeClient("test-api-key");

    await client.coreGet("/workspaces");
    await client.mcGet("/multichannel/workspaces/workspace-1/sequences");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requestedURLs, [
    "http://127.0.0.1:7777/public/v2/workspaces",
    "http://127.0.0.1:9891/public/multichannel/workspaces/workspace-1/sequences",
  ]);
});
