import { eq } from "drizzle-orm";
import { createProductSchema, type CreateProductInput, updateProductSchema, type UpdateProductInput } from "@/schemas/product";
import { roundQty } from "@/lib/qty";
import { db } from "@/server/db/client";
import { products, stockMovements } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export function createProduct(input: CreateProductInput, userId: number): ServiceResult<{ id: number }> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the product details." };
  try {
    const result = db.transaction((transaction) => {
      const now = new Date().toISOString();
      const openingStock = roundQty(parsed.data.openingStock);
      transaction.insert(products).values({
        name: parsed.data.name, sku: parsed.data.sku, barcode: parsed.data.barcode || null,
        category: parsed.data.category, unit: parsed.data.unit, costPrice: parsed.data.costPrice,
        sellPrice: parsed.data.sellPrice, stockQty: openingStock, lowStockThreshold: parsed.data.lowStockThreshold,
        imageUrl: parsed.data.imageUrl || null,
        isActive: true, createdAt: now, updatedAt: now,
      }).run();
      const product = transaction.select({ id: products.id }).from(products).where(eq(products.sku, parsed.data.sku)).limit(1).all()[0];
      if (!product) throw new Error("Product was not created.");
      if (openingStock > 0) transaction.insert(stockMovements).values({
        productId: product.id, type: "OPENING", qtyChange: openingStock, qtyAfter: openingStock,
        reasonCode: "OPENING_BALANCE", userId, createdAt: now,
      }).run();
      return product;
    });
    return { ok: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return { ok: false, code: "DUPLICATE_SKU", message: "SKU or barcode already exists." };
    throw error;
  }
}

export function updateProduct(id: number, input: UpdateProductInput): ServiceResult<{ id: number }> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the product details." };
  try {
    db.update(products).set({
      name: parsed.data.name, sku: parsed.data.sku, barcode: parsed.data.barcode || null,
      category: parsed.data.category, unit: parsed.data.unit, costPrice: parsed.data.costPrice,
      sellPrice: parsed.data.sellPrice, lowStockThreshold: parsed.data.lowStockThreshold,
      imageUrl: parsed.data.imageUrl || null,
      isActive: parsed.data.isActive, updatedAt: new Date().toISOString(),
    }).where(eq(products.id, id)).run();
    return { ok: true, data: { id } };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return { ok: false, code: "DUPLICATE_SKU", message: "SKU or barcode already exists." };
    throw error;
  }
}
