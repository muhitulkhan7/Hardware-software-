import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { products, saleItems, sales, settings, stockMovements, suppliers, users } from "./schema";

const now = new Date().toISOString();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const productSeed = [
  ["CEM-425", "600100100001", "Cement 42.5N", "Building", "bag", 650, 850, 42, 10],
  ["PVC-020", "600100100002", "PVC Pipe 20mm", "Plumbing", "length", 220, 320, 8, 12],
  ["PNT-EXT-5L", "600100100003", "Exterior Wall Paint", "Paint", "tin", 3000, 4200, 15, 5],
  ["ROOF-GALV", "600100100004", "Galvanized Roofing Sheet", "Roofing", "sheet", 1300, 1850, 0, 8],
  ["TLS-TROWEL", "600100100005", "Masonry Trowel", "Tools", "piece", 700, 1100, 24, 6],
  ["SCR-WD-50", "600100100006", "Wood Screws 50mm", "Hardware", "box", 420, 680, 56, 15],
] as const;

async function seed(): Promise<void> {
  const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, "admin@hardwarehub.local")).limit(1);
  if (existingAdmin.length > 0) {
    console.log("Seed already exists; no changes made.");
    return;
  }

  const [admin] = await db.insert(users).values({
    name: "Jane Mwangi",
    email: "admin@hardwarehub.local",
    passwordHash: hashPassword("DemoAdmin-2026"),
    role: "ADMIN",
    isActive: true,
  }).returning({ id: users.id });
  const [cashier] = await db.insert(users).values({
    name: "Sam Otieno",
    email: "cashier@hardwarehub.local",
    passwordHash: hashPassword("DemoCashier-2026"),
    role: "CASHIER",
    isActive: true,
  }).returning({ id: users.id });

  await db.insert(settings).values({
    id: 1,
    taxRateBp: 1600,
    maxDiscountPct: 15,
    defaultLowStockThreshold: 5,
    currency: "BDT",
    storeName: "Westlands Store",
    createdAt: now,
    updatedAt: now,
  });
  const [supplier] = await db.insert(suppliers).values({ name: "BuildRight Supplies" }).returning({ id: suppliers.id });

  for (const [sku, barcode, name, category, unit, costPrice, sellPrice, stockQty, lowStockThreshold] of productSeed) {
    const [product] = await db.insert(products).values({
      sku, barcode, name, category, unit, costPrice, sellPrice, stockQty, lowStockThreshold,
      isActive: true, createdAt: now, updatedAt: now,
    }).returning({ id: products.id });
    await db.insert(stockMovements).values({
      productId: product.id,
      type: "OPENING",
      qtyChange: stockQty,
      qtyAfter: stockQty,
      reasonCode: "OPENING_BALANCE",
      userId: admin.id,
      createdAt: now,
    });
  }

  const demoProduct = (await db.select().from(products).limit(1))[0];
  if (demoProduct) {
    const demoSaleTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [demoSale] = await db.insert(sales).values({
      invoiceNo: "INV-DEMO-001",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      cashierId: cashier.id,
      subtotal: demoProduct.sellPrice,
      discountType: "NONE",
      discountValue: 0,
      discountTotal: 0,
      taxRateBp: 1600,
      taxTotal: Math.round(demoProduct.sellPrice * 0.16),
      total: demoProduct.sellPrice + Math.round(demoProduct.sellPrice * 0.16),
      paymentMethod: "CASH",
      amountReceived: demoProduct.sellPrice + Math.round(demoProduct.sellPrice * 0.16),
      changeDue: 0,
      status: "COMPLETED",
      createdAt: demoSaleTime,
    }).returning({ id: sales.id });
    await db.insert(saleItems).values({
      saleId: demoSale.id,
      productId: demoProduct.id,
      nameSnapshot: demoProduct.name,
      skuSnapshot: demoProduct.sku,
      unitPrice: demoProduct.sellPrice,
      costSnapshot: demoProduct.costPrice,
      qty: 1,
      lineSubtotal: demoProduct.sellPrice,
      lineDiscount: 0,
      lineTax: Math.round(demoProduct.sellPrice * 0.16),
      lineTotal: demoProduct.sellPrice + Math.round(demoProduct.sellPrice * 0.16),
    });
    const nextStock = Math.max(0, demoProduct.stockQty - 1);
    await db.update(products).set({ stockQty: nextStock, updatedAt: demoSaleTime }).where(eq(products.id, demoProduct.id));
    await db.insert(stockMovements).values({
      productId: demoProduct.id,
      type: "SALE",
      qtyChange: -1,
      qtyAfter: nextStock,
      refType: "SALE",
      refId: demoSale.id,
      userId: cashier.id,
      createdAt: demoSaleTime,
    });
  }

  console.log(`Seeded HardwareHub demo data. Admin: ${admin.id}, cashier: ${cashier.id}, supplier: ${supplier.id}`);
}

seed().catch((error: unknown) => {
  console.error("Seed failed.", error);
  process.exitCode = 1;
});
