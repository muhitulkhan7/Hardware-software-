import { z } from "zod";

export const saleLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
});

export const discountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE"), value: z.literal(0) }),
  z.object({ type: z.literal("PERCENT"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("AMOUNT"), value: z.number().int().min(0) }),
]);

export const quoteSaleSchema = z.object({
  lines: z.array(saleLineSchema).min(1),
  discount: discountSchema,
});

export const confirmSaleSchema = quoteSaleSchema.extend({
  cashReceived: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
});

export type SaleLineInput = z.infer<typeof saleLineSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;
export type ConfirmSaleInput = z.infer<typeof confirmSaleSchema>;
