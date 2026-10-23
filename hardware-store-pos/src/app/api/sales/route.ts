import { NextResponse } from "next/server";
import { quoteSaleSchema, confirmSaleSchema } from "@/schemas/sale";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products, settings } from "@/server/db/schema";
import { confirmSale, quoteSale } from "@/server/services/sale";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const parsed = quoteSaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the sale details." }, { status: 400 });
  const config = (await db.select().from(settings).limit(1))[0];
  const rows = await db.select().from(products);
  const result = quoteSale(rows.map((p) => ({ id: p.id, name: p.name, sku: p.sku, sellPrice: p.sellPrice, stockQty: p.stockQty, isActive: p.isActive })), parsed.data.lines, parsed.data.discount, config?.taxRateBp ?? 0, config?.maxDiscountPct ?? 20);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const parsed = confirmSaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the payment details." }, { status: 400 });
  const result = confirmSale(parsed.data, session.data.id);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
