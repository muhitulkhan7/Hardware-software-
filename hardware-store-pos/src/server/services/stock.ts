import { eq } from "drizzle-orm";
import { adjustStockSchema, type AdjustStockInput } from "@/schemas/product";
import { roundQty } from "@/lib/qty";
import { db } from "@/server/db/client";
import { products, stockMovements } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export function adjustStock(input: AdjustStockInput, userId: number): ServiceResult<{ productId: number; stockQty: number }> {
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success || parsed.data.value < 0 && parsed.data.mode === "SET_COUNT") {
    return { ok: false, code: "VALIDATION", message: "Enter a valid stock adjustment and reason." };
  }

  const result = db.transaction((transaction) => {
    const [product] = transaction.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1).all();
    if (!product) return { ok: false as const, code: "NOT_FOUND" as const, message: "Product was not found." };

    const value = parsed.data.mode === "DELTA"
      ? Math.round(parsed.data.value * 1000) / 1000
      : roundQty(parsed.data.value);
    const nextStock = roundQty(parsed.data.mode === "DELTA" ? product.stockQty + value : value);
    if (nextStock < 0) return { ok: false as const, code: "INSUFFICIENT_STOCK" as const, message: "Adjustment cannot reduce stock below zero." };
    const qtyChange = Math.round((nextStock - product.stockQty) * 1000) / 1000;
    const now = new Date().toISOString();
    transaction.update(products).set({ stockQty: nextStock, updatedAt: now }).where(eq(products.id, product.id)).run();
    transaction.insert(stockMovements).values({
      productId: product.id,
      type: "ADJUSTMENT",
      qtyChange,
      qtyAfter: nextStock,
      reasonCode: parsed.data.reasonCode,
      note: parsed.data.note || null,
      userId,
      createdAt: now,
    }).run();
    return { ok: true as const, data: { productId: product.id, stockQty: nextStock } };
  });

  return result;
}
