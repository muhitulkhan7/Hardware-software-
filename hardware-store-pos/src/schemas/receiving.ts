import { z } from "zod";

export const receiveStockSchema = z.object({
  productId: z.number().int().positive(),
  supplierName: z.string().trim().min(2).max(120),
  quantity: z.number().positive(),
  unitCost: z.number().int().min(0),
  receivedDate: z.string().date(),
  imageUrl: z.string().url().max(2_000_000).optional(),
});

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
