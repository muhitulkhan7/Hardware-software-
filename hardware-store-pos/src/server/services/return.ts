import { eq, sql } from "drizzle-orm";
import { returnItemsSchema, type ReturnItemsInput } from "@/schemas/return";
import { roundQty } from "@/lib/qty";
import { db } from "@/server/db/client";
import { products, returnItems, returns, saleItems, sales, stockMovements } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export function returnItemsForSale(input: ReturnItemsInput, userId: number): ServiceResult<{ id: number; returnNo: string; refundTotal: number }> {
  const parsed = returnItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the return details." };
  return db.transaction((transaction) => {
    const existing = transaction.select({ id: returns.id, returnNo: returns.returnNo, refundTotal: returns.refundTotal })
      .from(returns).where(eq(returns.idempotencyKey, parsed.data.idempotencyKey)).limit(1).all()[0];
    if (existing) return { ok: true as const, data: existing };
    const sale = transaction.select().from(sales).where(eq(sales.id, parsed.data.saleId)).limit(1).all()[0];
    if (!sale) return { ok: false as const, code: "NOT_FOUND" as const, message: "Sale was not found." };
    for (const line of parsed.data.lines) {
      const item = transaction.select().from(saleItems).where(eq(saleItems.id, line.saleItemId)).limit(1).all()[0];
      if (!item || item.saleId !== sale.id) return { ok: false as const, code: "NOT_FOUND" as const, message: "Sale item was not found." };
      const returned = transaction.select({ qty: sql<number>`coalesce(sum(${returnItems.qty}), 0)` }).from(returnItems).where(eq(returnItems.saleItemId, item.id)).all()[0]?.qty ?? 0;
      if (returned + roundQty(line.quantity) > item.qty) return { ok: false as const, code: "OVER_RETURN" as const, message: "Return quantity exceeds the sold quantity." };
    }
    let refundTotal = 0;
    const now = new Date().toISOString();
    const returnNo = `RET-${Date.now()}`;
    transaction.insert(returns).values({
      returnNo, idempotencyKey: parsed.data.idempotencyKey, saleId: sale.id, userId,
      reason: parsed.data.reason, refundTotal: 0, refundMethod: "CASH", createdAt: now,
    }).run();
    const createdReturn = transaction.select({ id: returns.id }).from(returns).where(eq(returns.returnNo, returnNo)).limit(1).all()[0];
    if (!createdReturn) throw new Error("Return was not created.");
    for (const line of parsed.data.lines) {
      const item = transaction.select().from(saleItems).where(eq(saleItems.id, line.saleItemId)).limit(1).all()[0];
      if (!item || item.saleId !== sale.id) return { ok: false as const, code: "NOT_FOUND" as const, message: "Sale item was not found." };
      const returned = transaction.select({ qty: sql<number>`coalesce(sum(${returnItems.qty}), 0)` }).from(returnItems).where(eq(returnItems.saleItemId, item.id)).all()[0]?.qty ?? 0;
      const quantity = roundQty(line.quantity);
      if (returned + quantity > item.qty) return { ok: false as const, code: "OVER_RETURN" as const, message: "Return quantity exceeds the sold quantity." };
      const unitRefund = Math.round(item.lineTotal / item.qty);
      const lineRefund = Math.round(unitRefund * quantity);
      refundTotal += lineRefund;
      transaction.insert(returnItems).values({
        returnId: createdReturn.id, saleItemId: item.id, qty: quantity,
        unitRefund, refundTotal: lineRefund, restock: line.restock,
      }).run();
      if (line.restock) {
        const product = transaction.select().from(products).where(eq(products.id, item.productId)).limit(1).all()[0];
        if (product) {
          const stockQty = roundQty(product.stockQty + quantity);
          transaction.update(products).set({ stockQty, updatedAt: now }).where(eq(products.id, product.id)).run();
          transaction.insert(stockMovements).values({
            productId: product.id, type: "RETURN", qtyChange: quantity, qtyAfter: stockQty,
            refType: "RETURN", refId: createdReturn.id, userId, createdAt: now,
          }).run();
        }
      }
    }
    transaction.update(returns).set({ refundTotal }).where(eq(returns.id, createdReturn.id)).run();
    return { ok: true as const, data: { id: createdReturn.id, returnNo, refundTotal } };
  });
}
