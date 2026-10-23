import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { updateProductSchema } from "@/schemas/product";
import { requireRole, requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products, stockMovements } from "@/server/db/schema";
import { updateProduct } from "@/server/services/product";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const id = Number((await context.params).id);
  const product = (await db.select().from(products).where(eq(products.id, id)).limit(1))[0];
  if (!product) return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Product was not found." }, { status: 404 });
  const history = await db.select().from(stockMovements).where(eq(stockMovements.productId, id)).orderBy(desc(stockMovements.createdAt));
  return NextResponse.json({ ok: true, data: { product, history } });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const parsed = updateProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the product details." }, { status: 400 });
  const result = updateProduct(Number((await context.params).id), parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
