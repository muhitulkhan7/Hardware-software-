import { eq } from "drizzle-orm";
import { receiveStockSchema, type ReceiveStockInput } from "@/schemas/receiving";
import { roundQty } from "@/lib/qty";
import { db } from "@/server/db/client";
import { products, receiptsIn, stockMovements, suppliers } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export function receiveStock(input: ReceiveStockInput, userId: number): ServiceResult<{ productId: number; stockQty: number }> {
  const parsed = receiveStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the receiving details." };
  return db.transaction((transaction) => {
    const product = transaction.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1).all()[0];
    if (!product || !product.isActive) return { ok: false as const, code: "NOT_FOUND" as const, message: "Active product was not found." };
    const supplier = transaction.select().from(suppliers).where(eq(suppliers.name, parsed.data.supplierName)).limit(1).all()[0]
      ?? transaction.insert(suppliers).values({ name: parsed.data.supplierName }).returning({ id: suppliers.id }).all()[0];
    const quantity = roundQty(parsed.data.quantity);
    const stockQty = roundQty(product.stockQty + quantity);
    const now = new Date().toISOString();
    transaction.insert(receiptsIn).values({
      productId: product.id, supplierId: supplier.id, qty: quantity,
      unitCost: parsed.data.unitCost, total: parsed.data.unitCost * quantity,
      receivedDate: parsed.data.receivedDate, userId, createdAt: now,
    }).run();
    transaction.update(products).set({ stockQty, costPrice: parsed.data.unitCost, imageUrl: parsed.data.imageUrl || product.imageUrl, updatedAt: now }).where(eq(products.id, product.id)).run();
    transaction.insert(stockMovements).values({
      productId: product.id, type: "RECEIVE", qtyChange: quantity, qtyAfter: stockQty,
      refType: "RECEIPT", userId, createdAt: now,
    }).run();
    return { ok: true as const, data: { productId: product.id, stockQty } };
  });
}
