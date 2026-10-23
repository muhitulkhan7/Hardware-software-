import { z } from "zod";

export const updateSettingsSchema = z.object({
  taxRateBp: z.number().int().min(0).max(10000),
  maxDiscountPct: z.number().int().min(0).max(100),
  defaultLowStockThreshold: z.number().min(0),
  storeName: z.string().trim().min(2).max(120),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
