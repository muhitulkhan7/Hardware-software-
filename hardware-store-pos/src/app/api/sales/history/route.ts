import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { sales, users } from "@/server/db/schema";

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const rows = await db.select({
    id: sales.id, invoiceNo: sales.invoiceNo, total: sales.total, paymentMethod: sales.paymentMethod,
    createdAt: sales.createdAt, cashier: users.name,
  }).from(sales).leftJoin(users, eq(users.id, sales.cashierId)).orderBy(desc(sales.createdAt)).limit(100);
  return NextResponse.json({ ok: true, data: rows });
}
