import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SalesforgeClient } from "../client.js";
import { handleTool, enc, buildQuery } from "../helpers.js";

const LANGUAGES = [
  "american_english", "british_english", "brazilian_portugese", "czech", "danish", "dutch", "estonian",
  "finnish", "french", "german", "hungarian", "italian", "japanese", "latvian", "lithuanian", "norwegian",
  "polish", "romanian", "russian", "spanish", "swedish", "ukrainian",
] as const;

const language = z.enum(LANGUAGES).describe("Language the content is written in");

const cardFields = {
  name: z.string().min(1).describe("Product name the AI uses when it mentions the offering in messages"),
  industry: z.string().min(1).describe('Industry the product sells into, e.g. "Sales technology"'),
  idealCustomerProfile: z.string().describe('Who the product is sold to, e.g. "Sales teams at B2B SaaS companies"'),
  pain: z.string().min(1).max(300).describe(
    "The customer's problem and what it costs them, in active language (struggle, waste, miss). Scored on pain points, business impact and active language",
  ),
  solution: z.string().min(1).max(300).describe(
    "How the product solves the pain: key benefits with measurable results. Scored on key benefits and metrics",
  ),
  costOfInaction: z.string().min(1).max(300).describe(
    "What customers lose by not solving the problem, with numbers and urgency. Scored on missed opportunities, metrics and urgency",
  ),
  proofPoints: z.string().min(1).max(300).describe(
    "Evidence it works: customer results, number of clients or reviews, awards, guarantees. Scored on social proof, metrics and guarantees",
  ),
};

const internalName = z.string().describe("Name the team uses for this product. Never shown to prospects");
const cardPatch = z.object(cardFields).partial();

export function registerProductTools(server: McpServer, client: SalesforgeClient) {
  server.registerTool("list_products", {
    description: "List the workspace's Product cards. Each card has one entry per language in translations; the entry whose language matches the card's language is the main one.",
    inputSchema: {
      workspaceId: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional().describe("Page size, default 10"),
      offset: z.number().int().nonnegative().optional(),
    },
  }, ({ workspaceId, ...page }) =>
    handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/products`, buildQuery(page))));

  server.registerTool("get_product", {
    description: "Get a Product card with every language's content, quality evaluation and translation IDs.",
    inputSchema: {
      workspaceId: z.string().min(1),
      productId: z.string().min(1),
    },
  }, ({ workspaceId, productId }) =>
    handleTool(() => client.coreGet(`/workspaces/${enc(workspaceId)}/products/${enc(productId)}`)));

  server.registerTool("create_product", {
    description: "Create a Product card, the offering the AI writes outreach about. product is the main language, which can't change later; translation adds the same card in other languages, taking industry and idealCustomerProfile from product when left out. Every language is scored on pain, solution, costOfInaction and proofPoints: read the returned evaluations and improve any field whose checks are false with update_product.",
    inputSchema: {
      workspaceId: z.string().min(1),
      product: z.object({ ...cardFields, internalName: internalName.optional(), language }),
      translation: z.array(z.object({
        ...cardFields,
        industry: cardFields.industry.optional(),
        idealCustomerProfile: cardFields.idealCustomerProfile.optional(),
        language,
      })).optional().describe("The same card in other languages, one entry per language"),
    },
  }, ({ workspaceId, product, translation }) =>
    handleTool(() => client.corePost(`/workspaces/${enc(workspaceId)}/products`, {
      product,
      translation: translation?.map((entry) => ({
        industry: product.industry,
        idealCustomerProfile: product.idealCustomerProfile,
        ...entry,
      })),
    })));

  server.registerTool("update_product", {
    description: "Update a Product card. Send only the fields to change; anything left out stays as it is. product changes the main language. translation entries are matched by language: an existing one is updated and a new one is added (a new one needs name, pain, solution, costOfInaction and proofPoints; industry and idealCustomerProfile default to the main product's). The main language can't be sent in translation. Each language whose pain, solution, costOfInaction or proofPoints changed is scored again: read the returned evaluation and improve any field whose checks are false.",
    inputSchema: {
      workspaceId: z.string().min(1),
      productId: z.string().min(1),
      product: cardPatch.extend({ internalName: internalName.optional() }).optional(),
      translation: z.array(cardPatch.extend({ language })).optional(),
    },
  }, ({ workspaceId, productId, product, translation }) =>
    handleTool(() => client.corePatch(`/workspaces/${enc(workspaceId)}/products/${enc(productId)}`, {
      product,
      translation,
    })));

  server.registerTool("delete_product", {
    description: "Delete a Product card. Sequences already using it keep running with its last content.",
    inputSchema: {
      workspaceId: z.string().min(1),
      productId: z.string().min(1),
    },
  }, ({ workspaceId, productId }) =>
    handleTool(() => client.coreDelete(`/workspaces/${enc(workspaceId)}/products/${enc(productId)}`)));

  server.registerTool("delete_product_translation", {
    description: "Delete one translation of a Product card by the id of its entry in translations, from get_product. The main language entry has no id and can't be deleted; delete the product instead.",
    inputSchema: {
      workspaceId: z.string().min(1),
      productId: z.string().min(1),
      translationId: z.string().min(1),
    },
  }, ({ workspaceId, productId, translationId }) =>
    handleTool(() => client.coreDelete(
      `/workspaces/${enc(workspaceId)}/products/${enc(productId)}/translations/${enc(translationId)}`,
    )));
}
