import { and, eq } from "drizzle-orm";
import { calculateTax, type Money, roundMoney } from "@/lib/money";
import { roundQty } from "@/lib/qty";
import { confirmSaleSchema, quoteSaleSchema, type ConfirmSaleInput, type DiscountInput, type SaleLineInput } from "@/schemas/sale";
import { db } from "@/server/db/client";
import { products as productTable, saleItems, sales, settings, stockMovements } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export type SaleProduct = {
  id: number;
  name: string;
  sku: string;
  sellPrice: Money;
  stockQty: number;
  isActive: boolean;
};

export type SaleQuoteLine = SaleProduct & {
  quantity: number;
  lineSubtotal: Money;
  lineDiscount: Money;
  lineTotal: Money;
};

export type SaleQuote = {
  lines: SaleQuoteLine[];
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  total: Money;
};

export type CompletedSale = { id: number; invoiceNo: string; total: Money; changeDue: Money };

export function quoteSale(
  products: SaleProduct[],
  lines: SaleLineInput[],
  discount: DiscountInput,
  taxRateBp = 0,
  maxDiscountPct = 100,
): ServiceResult<SaleQuote> {
  const parsed = quoteSaleSchema.safeParse({ lines, discount });
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Check the sale details." };
  }

  if (discount.type === "PERCENT" && discount.value > maxDiscountPct) {
    return { ok: false, code: "DISCOUNT_TOO_HIGH", message: "Discount exceeds the configured limit." };
  }

  const quoteLines: SaleQuoteLine[] = [];
  for (const line of parsed.data.lines) {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product) return { ok: false, code: "NOT_FOUND", message: "One of the selected products was not found." };
    if (!product.isActive) return { ok: false, code: "VALIDATION", message: `${product.name} is inactive.` };
    const quantity = roundQty(line.quantity);
    if (quantity > product.stockQty) {
      return { ok: false, code: "INSUFFICIENT_STOCK", message: `${product.name} does not have enough stock.` };
    }
    quoteLines.push({ ...product, quantity, lineSubtotal: roundMoney(product.sellPrice * quantity), lineDiscount: 0, lineTotal: 0 });
  }

  const subtotal = quoteLines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const discountTotal = discount.type === "PERCENT"
    ? roundMoney((subtotal * discount.value) / 100)
    : Math.min(discount.value, subtotal);
  const lineDiscounts = allocateDiscount(quoteLines.map((line) => line.lineSubtotal), discountTotal);
  quoteLines.forEach((line, index) => {
    line.lineDiscount = lineDiscounts[index];
    line.lineTotal = line.lineSubtotal - line.lineDiscount;
  });
  const taxTotal = calculateTax(subtotal - discountTotal, taxRateBp);
  return { ok: true, data: { lines: quoteLines, subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal } };
}

function allocateDiscount(subtotals: Money[], totalDiscount: Money): Money[] {
  const subtotal = subtotals.reduce((sum, value) => sum + value, 0);
  if (subtotal === 0 || totalDiscount === 0) return subtotals.map(() => 0);
  const allocations = subtotals.map((value) => roundMoney((value / subtotal) * totalDiscount));
  const difference = totalDiscount - allocations.reduce((sum, value) => sum + value, 0);
  if (difference !== 0 && allocations.length > 0) allocations[allocations.length - 1] += difference;
  return allocations;
}

function allocateTax(lineTotals: Money[], totalTax: Money): Money[] {
  const taxableTotal = lineTotals.reduce((sum, value) => sum + value, 0);
  if (taxableTotal === 0 || totalTax === 0) return lineTotals.map(() => 0);
  const allocations = lineTotals.map((value) => roundMoney((value / taxableTotal) * totalTax));
  const difference = totalTax - allocations.reduce((sum, value) => sum + value, 0);
  if (difference !== 0 && allocations.length > 0) allocations[allocations.length - 1] += difference;
  return allocations;
}

export function confirmSale(input: ConfirmSaleInput, cashierId: number): ServiceResult<CompletedSale> {
  const parsed = confirmSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the payment details." };

  return db.transaction((transaction) => {
    const existing = transaction.select({ id: sales.id, invoiceNo: sales.invoiceNo, total: sales.total, changeDue: sales.changeDue })
      .from(sales).where(eq(sales.idempotencyKey, parsed.data.idempotencyKey)).limit(1).all()[0];
    if (existing) return { ok: true as const, data: existing };
    const config = transaction.select().from(settings).where(eq(settings.id, 1)).limit(1).all()[0];
    const rows = transaction.select().from(productTable).all();
    const quote = quoteSale(rows.map((p) => ({
      id: p.id, name: p.name, sku: p.sku, sellPrice: p.sellPrice, stockQty: p.stockQty, isActive: p.isActive,
    })), parsed.data.lines, parsed.data.discount, config?.taxRateBp ?? 0, config?.maxDiscountPct ?? 20);
    if (!quote.ok) return quote;
    if (parsed.data.cashReceived < quote.data.total) return { ok: false as const, code: "INSUFFICIENT_PAYMENT" as const, message: "Cash received is less than the sale total." };

    const now = new Date().toISOString();
    const invoiceNo = `INV-${Date.now()}`;
    transaction.insert(sales).values({
      invoiceNo, idempotencyKey: parsed.data.idempotencyKey, cashierId,
      subtotal: quote.data.subtotal, discountType: parsed.data.discount.type, discountValue: parsed.data.discount.value,
      discountTotal: quote.data.discountTotal, taxRateBp: config?.taxRateBp ?? 0, taxTotal: quote.data.taxTotal,
      total: quote.data.total, paymentMethod: "CASH", amountReceived: parsed.data.cashReceived,
      changeDue: parsed.data.cashReceived - quote.data.total, status: "COMPLETED", createdAt: now,
    }).run();
    const sale = transaction.select({ id: sales.id }).from(sales).where(eq(sales.invoiceNo, invoiceNo)).limit(1).all()[0];
    if (!sale) throw new Error("Sale was not created.");

    const lineTaxes = allocateTax(quote.data.lines.map((line) => line.lineTotal), quote.data.taxTotal);
    for (const [index, line] of quote.data.lines.entries()) {
      const product = transaction.select().from(productTable)
        .where(and(eq(productTable.id, line.id), eq(productTable.isActive, true))).limit(1).all()[0];
      if (!product || product.stockQty < line.quantity) return { ok: false as const, code: "INSUFFICIENT_STOCK" as const, message: `${line.name} does not have enough stock.` };
      const lineTax = lineTaxes[index];
      transaction.insert(saleItems).values({
        saleId: sale.id, productId: product.id, nameSnapshot: product.name, skuSnapshot: product.sku,
        unitPrice: product.sellPrice, costSnapshot: product.costPrice, qty: line.quantity,
        lineSubtotal: line.lineSubtotal, lineDiscount: line.lineDiscount, lineTax, lineTotal: line.lineTotal + lineTax,
      }).run();
      const nextStock = roundQty(product.stockQty - line.quantity);
      transaction.update(productTable).set({ stockQty: nextStock, updatedAt: now }).where(eq(productTable.id, product.id)).run();
      transaction.insert(stockMovements).values({
        productId: product.id, type: "SALE", qtyChange: -line.quantity, qtyAfter: nextStock,
        refType: "SALE", refId: sale.id, userId: cashierId, createdAt: now,
      }).run();
    }
    return { ok: true as const, data: { id: sale.id, invoiceNo, total: quote.data.total, changeDue: parsed.data.cashReceived - quote.data.total } };
  });
}
