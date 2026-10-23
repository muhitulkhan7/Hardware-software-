import { asc, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getStockStatus } from "@/lib/status";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products } from "@/server/db/schema";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const rows = await db.select().from(products).where(
    query
      ? or(like(products.name, `%${query}%`), like(products.sku, `%${query}%`), like(products.barcode, `%${query}%`))
      : undefined,
  ).orderBy(asc(products.name));

  return NextResponse.json({
    ok: true,
    data: rows.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category,
      unit: product.unit,
      price: product.sellPrice,
      costPrice: product.costPrice,
      stock: product.stockQty,
      threshold: product.lowStockThreshold,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      color: "#e6d6bd",
      status: getStockStatus(product.stockQty, product.lowStockThreshold),
    })),
  });
}
