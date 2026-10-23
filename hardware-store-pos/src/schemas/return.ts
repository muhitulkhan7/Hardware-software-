import { z } from "zod";

export const returnItemsSchema = z.object({
  saleId: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(2).max(250),
  lines: z.array(z.object({
    saleItemId: z.number().int().positive(),
    quantity: z.number().positive(),
    restock: z.boolean(),
  })).min(1),
});

export type ReturnItemsInput = z.infer<typeof returnItemsSchema>;
