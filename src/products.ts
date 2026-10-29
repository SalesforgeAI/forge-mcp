/** The Forge products this server has tools for, each with its own API key; Salesforge's key also covers Multichannel. */
export const PRODUCTS = ["salesforge", "primeforge", "infraforge", "leadsforge", "warmforge", "mailforge"] as const;

export type Product = (typeof PRODUCTS)[number];
