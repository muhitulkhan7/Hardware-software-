import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products } from "@/server/db/schema";
import { photoChoiceSchema, photoLookupSchema } from "@/schemas/photo";
import { photoLookups } from "@/server/db/schema";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const parsed = photoLookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Provide a valid product photo." }, { status: 400 });
  const candidates = await db.select({ id: products.id, name: products.name, sku: products.sku, imageUrl: products.imageUrl })
    .from(products).where(eq(products.isActive, true)).limit(5);
  const lookup = await db.insert(photoLookups).values({
    userId: session.data.id,
    visibleText: null,
    candidateIds: JSON.stringify(candidates.map((candidate) => candidate.id)),
    createdAt: new Date().toISOString(),
  }).returning({ id: photoLookups.id });
  return NextResponse.json({ ok: true, data: { lookupId: lookup[0]?.id, visibleText: null, candidates, message: "Photo received. Confirm a catalog candidate." } });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  const parsed = photoChoiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Choose a valid catalog product." }, { status: 400 });
  const updated = db.transaction((transaction) => {
    const lookup = transaction.select({ candidateIds: photoLookups.candidateIds })
      .from(photoLookups)
      .where(and(eq(photoLookups.id, parsed.data.lookupId), eq(photoLookups.userId, session.data.id)))
      .limit(1).all()[0];
    if (!lookup) return false;
    let candidates: number[] = [];
    try {
      const parsedCandidates: unknown = JSON.parse(lookup.candidateIds);
      if (Array.isArray(parsedCandidates)) candidates = parsedCandidates.filter((id): id is number => typeof id === "number");
    } catch {
      return false;
    }
    if (!candidates.includes(parsed.data.chosenProductId)) return false;
    transaction.update(photoLookups).set({ chosenProductId: parsed.data.chosenProductId })
      .where(eq(photoLookups.id, parsed.data.lookupId)).run();
    return true;
  });
  if (!updated) return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "That photo lookup is no longer available." }, { status: 404 });
  return NextResponse.json({ ok: true, data: { chosenProductId: parsed.data.chosenProductId } });
}
