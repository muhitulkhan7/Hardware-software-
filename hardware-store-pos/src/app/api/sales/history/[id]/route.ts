import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { returnItems, saleItems, sales } from "@/server/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Invalid sale." }, { status: 400 });

  const sale = db.select({
    id: sales.id,
    invoiceNo: sales.invoiceNo,
    subtotal: sales.subtotal,
    discountTotal: sales.discountTotal,
    taxTotal: sales.taxTotal,
    total: sales.total,
    paymentMethod: sales.paymentMethod,
    amountReceived: sales.amountReceived,
    changeDue: sales.changeDue,
    createdAt: sales.createdAt,
  }).from(sales).where(eq(sales.id, id)).limit(1).all()[0];
  if (!sale) return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Sale was not found." }, { status: 404 });

  const items = db.select({
    id: saleItems.id,
    productId: saleItems.productId,
    name: saleItems.nameSnapshot,
    sku: saleItems.skuSnapshot,
    qty: saleItems.qty,
    unitPrice: saleItems.unitPrice,
    lineTotal: saleItems.lineTotal,
    returnedQty: sql<number>`coalesce(sum(${returnItems.qty}), 0)`,
  }).from(saleItems)
    .leftJoin(returnItems, eq(returnItems.saleItemId, saleItems.id))
    .where(eq(saleItems.saleId, id))
    .groupBy(saleItems.id)
    .all();

  const returnedQuantity = items.reduce((sum, item) => sum + Number(item.returnedQty), 0);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.qty), 0);
  return NextResponse.json({
    ok: true,
    data: {
      sale,
      items,
      returnStatus: returnedQuantity === 0 ? "Completed" : returnedQuantity >= totalQuantity ? "Fully returned" : "Partially returned",
    },
  });
}
