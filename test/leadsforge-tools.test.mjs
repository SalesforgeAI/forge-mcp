import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { ApiClient } from "../dist/api-client.js";

/** Connect an MCP client to a leadsforge-only server without network listeners. */
async function setup(t) {
  const server = createServer({
    leadsforge: new ApiClient("test-api-key", "https://api.leadsforge.ai/public/v1", "Leadsforge"),
  });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

const base = "https://api.leadsforge.ai/public/v1";

const expected = [
  "leadsforge_count_search_results",
  "leadsforge_enrich_business_owners",
  "leadsforge_enrich_email_sync",
  "leadsforge_enrich_emails",
  "leadsforge_enrich_linkedin",
  "leadsforge_enrich_phone_sync",
  "leadsforge_enrich_phones",
  "leadsforge_get_balance",
  "leadsforge_get_company_followers_job",
  "leadsforge_get_company_followers_results",
  "leadsforge_get_department_filters",
  "leadsforge_get_employee_range_filters",
  "leadsforge_get_enrichment_job",
  "leadsforge_get_enrichment_results",
  "leadsforge_get_followers_country_filters",
  "leadsforge_get_followers_department_filters",
  "leadsforge_get_followers_job_title_filters",
  "leadsforge_get_followers_level_filters",
  "leadsforge_get_followers_state_filters",
  "leadsforge_get_lookalikes_location_filters",
  "leadsforge_get_maps_category_filters",
  "leadsforge_get_maps_owner_job",
  "leadsforge_get_maps_owner_results",
  "leadsforge_get_maps_search_job",
  "leadsforge_get_maps_search_results",
  "leadsforge_get_search_company_type_filters",
  "leadsforge_get_search_department_filters",
  "leadsforge_get_search_funding_type_filters",
  "leadsforge_get_search_industry_filters",
  "leadsforge_get_search_revenue_range_filters",
  "leadsforge_get_search_seniority_filters",
  "leadsforge_get_seniority_filters",
  "leadsforge_list_company_followers_jobs",
  "leadsforge_list_enrichment_jobs",
  "leadsforge_list_maps_owner_jobs",
  "leadsforge_list_maps_search_jobs",
  "leadsforge_preview_lookalikes",
  "leadsforge_search",
  "leadsforge_search_company_followers",
  "leadsforge_search_local_businesses",
  "leadsforge_search_lookalikes",
];

test("every leadsforge public API endpoint is exposed as a tool", async (t) => {
  const client = await setup(t);
  const names = (await client.listTools()).tools
    .filter((tool) => tool.name.startsWith("leadsforge_"))
    .map((tool) => tool.name)
    .sort();
  assert.deepEqual(names, expected);
});

test("leadsforge tools map inputs to the public API contracts", async (t) => {
  const client = await setup(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: new URL(url), method: init.method, body: init.body && JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  const cases = [
    ["leadsforge_count_search_results", { companyDomains: { include: ["salesforge.ai"] } },
      "POST", `${base}/search/count`, {}, { companyDomains: { include: ["salesforge.ai"] } }],
    ["leadsforge_get_search_industry_filters", { search: "software" },
      "GET", `${base}/search/filters/industries`, { search: "software", limit: "100" }],
    ["leadsforge_enrich_email_sync", { linkedinURL: "https://www.linkedin.com/in/ada", externalID: "crm-42" },
      "POST", `${base}/enrichment/email`, {}, { linkedinURL: "https://www.linkedin.com/in/ada", externalID: "crm-42" }],
    ["leadsforge_list_enrichment_jobs", { status: "completed" },
      "GET", `${base}/enrichment/jobs`, { limit: "25", status: "completed" }],
    ["leadsforge_preview_lookalikes", { domains: ["salesforge.ai"] },
      "POST", `${base}/lookalikes/preview`, {}, { domains: ["salesforge.ai"] }],
    ["leadsforge_search_company_followers", { linkedinUrl: "https://www.linkedin.com/company/salesforge", limit: 100, levels: ["cxo"] },
      "POST", `${base}/company-followers/search`, {}, { linkedinUrl: "https://www.linkedin.com/company/salesforge", limit: 100, levels: ["cxo"] }],
    ["leadsforge_get_company_followers_results", { jobID: "pcfj_1" },
      "GET", `${base}/company-followers/jobs/pcfj_1/results`, { limit: "100" }],
    ["leadsforge_get_followers_job_title_filters", { search: "sales", pageSize: 20 },
      "GET", `${base}/company-followers/filters/job-titles`, { search: "sales", page_size: "20" }],
    ["leadsforge_search_local_businesses", { categories: ["dentist"], lat: 52.37, lng: 4.9, radiusKm: 10, limit: 50 },
      "POST", `${base}/maps-discovery/search`, {}, { categories: ["dentist"], lat: 52.37, lng: 4.9, radiusKm: 10, limit: 50 }],
    ["leadsforge_enrich_business_owners", { searchJobID: "job-1", businessIDs: ["b1"], maxResults: 2, wantEmail: true },
      "POST", `${base}/maps-discovery/enrich-owners`, {}, { searchJobID: "job-1", businessIDs: ["b1"], maxResults: 2, wantEmail: true }],
    ["leadsforge_get_maps_owner_results", { jobID: "job-1", limit: 200, offset: 5000 },
      "GET", `${base}/maps-discovery/owner-jobs/job-1/results`, { limit: "200", offset: "5000" }],
    ["leadsforge_get_maps_category_filters", {}, "GET", `${base}/maps-discovery/filters/categories`, {}],
  ];

  for (const [name, args, method, url, query, body] of cases) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name}: ${JSON.stringify(result)}`);
    const call = calls.at(-1);
    assert.equal(call.method, method, name);
    assert.equal(call.url.origin + call.url.pathname, url, name);
    assert.deepEqual(Object.fromEntries(call.url.searchParams), query, name);
    assert.deepEqual(call.body, body, name);
  }
});
