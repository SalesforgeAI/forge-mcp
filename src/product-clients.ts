import { ApiClient } from "./api-client.js";
import { SalesforgeClient } from "./client.js";
import type { Product } from "./products.js";
import type { ProductClients } from "./server.js";

export type ProductKeys = Partial<Record<Product, string | undefined>>;

/** A product's public API: production unless `<PRODUCT>_API_URL` points at another environment, such as dev. */
function apiUrl(product: Product, production: string): string {
  return process.env[`${product.toUpperCase()}_API_URL`]?.trim() || production;
}

/**
 * One client per product that has a key; how each key is sent is the product API's own convention.
 * `onUnauthorized` is given for managed keys only; see isRevokedKey.
 */
export function buildProductClients(keys: ProductKeys, onUnauthorized?: (product: Product) => void): ProductClients {
  const on = (product: Product) => onUnauthorized && (() => onUnauthorized(product));
  const clients: ProductClients = {};
  if (keys.salesforge) clients.salesforge = new SalesforgeClient(keys.salesforge, on("salesforge"));
  if (keys.primeforge) clients.primeforge = new ApiClient(keys.primeforge, apiUrl("primeforge", "https://api.primeforge.ai/public"), "PrimeForge", on("primeforge"));
  if (keys.leadsforge) clients.leadsforge = new ApiClient(keys.leadsforge, apiUrl("leadsforge", "https://api.leadsforge.ai/public/v1"), "LeadsForge", on("leadsforge"));
  if (keys.infraforge) clients.infraforge = new ApiClient(keys.infraforge, apiUrl("infraforge", "https://api.infraforge.ai/public"), "InfraForge", on("infraforge"));
  if (keys.warmforge) clients.warmforge = new ApiClient("Bearer " + keys.warmforge, apiUrl("warmforge", "https://api.warmforge.ai/public/v1"), "WarmForge", on("warmforge"));
  if (keys.mailforge) clients.mailforge = new ApiClient(keys.mailforge, apiUrl("mailforge", "https://api.mailforge.ai/public"), "MailForge", on("mailforge"));
  return clients;
}
