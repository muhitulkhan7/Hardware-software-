import { desc, sql, type SQLWrapper } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products, returnItems, returns, saleItems, sales } from "@/server/db/schema";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
    return NextResponse.json({ ok: false, code: "VALIDATION", message: "Use valid report dates." }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ ok: false, code: "VALIDATION", message: "Report start date must be before the end date." }, { status: 400 });
  }
  const start = from ? `${from}T00:00:00.000Z` : null;
  const end = to ? `${to}T23:59:59.999Z` : null;
  const dateFilter = (column: SQLWrapper) => sql`${column} >= coalesce(${start}, '0000-01-01T00:00:00.000Z') AND ${column} <= coalesce(${end}, '9999-12-31T23:59:59.999Z')`;
  const [salesSummary] = await db.select({
    netSales: sql<number>`coalesce(sum(${sales.total}), 0)`,
    transactions: sql<number>`count(${sales.id})`,
  }).from(sales).where(dateFilter(sales.createdAt));
  const [profitSummary] = await db.select({
    grossProfit: sql<number>`coalesce(sum(${saleItems.lineTotal} - (${saleItems.costSnapshot} * ${saleItems.qty})), 0)`,
  }).from(saleItems).innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`).where(dateFilter(sales.createdAt));
  const [refundSummary] = await db.select({
    refunds: sql<number>`coalesce(sum(${returns.refundTotal}), 0)`,
    returnedItems: sql<number>`coalesce(sum(${returnItems.qty}), 0)`,
  }).from(returns).leftJoin(returnItems, sql`${returnItems.returnId} = ${returns.id}`).where(dateFilter(returns.createdAt));
  const bestSellers = await db.select({
    productId: saleItems.productId, name: saleItems.nameSnapshot, quantity: sql<number>`sum(${saleItems.qty})`,
  }).from(saleItems).innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`).where(dateFilter(sales.createdAt)).groupBy(saleItems.productId, saleItems.nameSnapshot).orderBy(desc(sql`sum(${saleItems.qty})`)).limit(10);
  const lowStock = await db.select().from(products).where(sql`${products.stockQty} <= ${products.lowStockThreshold}`).limit(50);
  return NextResponse.json({ ok: true, data: { ...salesSummary, ...profitSummary, ...refundSummary, bestSellers, lowStock, from, to } });
}
