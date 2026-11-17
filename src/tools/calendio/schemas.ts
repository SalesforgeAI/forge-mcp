import { z } from "zod";

export const idSchema = z.uuid();

export const pageSchema = z.number().int().min(1).optional().describe("Page number (starts at 1)");

export const sizeSchema = z.number().int().min(10).max(50).optional().describe("Results per page (10-50, default 10)");
