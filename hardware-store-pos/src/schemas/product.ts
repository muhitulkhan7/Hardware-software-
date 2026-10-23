import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9-]+$/),
  barcode: z.string().trim().min(4).max(80).optional(),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(30),
  costPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
  openingStock: z.number().min(0),
  lowStockThreshold: z.number().min(0),
  imageUrl: z.string().url().max(2_000_000).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const adjustStockSchema = z.object({
  productId: z.number().int().positive(),
  mode: z.enum(["DELTA", "SET_COUNT"]),
  value: z.number(),
  reasonCode: z.enum(["DAMAGE", "COUNT_CORRECTION", "LOSS", "FOUND", "OTHER"]),
  note: z.string().trim().max(250).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const updateProductSchema = createProductSchema.omit({ openingStock: true }).extend({
  isActive: z.boolean(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
