import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products, sales, users } from "@/server/db/schema";

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const [summary] = await db.select({
    netSales: sql<number>`coalesce(sum(${sales.total}), 0)`,
    transactions: sql<number>`count(${sales.id})`,
  }).from(sales);
  const productCount = (await db.select({ count: sql<number>`count(${products.id})` }).from(products).where(eq(products.isActive, true)))[0]?.count ?? 0;
  const alerts = await db.select().from(products).where(sql`${products.stockQty} <= ${products.lowStockThreshold}`).limit(10);
  const recentSales = await db.select({
    invoiceNo: sales.invoiceNo, total: sales.total, createdAt: sales.createdAt, cashier: users.name,
  }).from(sales).leftJoin(users, eq(users.id, sales.cashierId)).orderBy(desc(sales.createdAt)).limit(5);
  return NextResponse.json({ ok: true, data: { ...summary, productCount, alerts, recentSales } });
}
