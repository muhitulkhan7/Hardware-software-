import { relations } from "drizzle-orm";
import { check, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "CASHIER"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  costPrice: integer("cost_price").notNull(),
  sellPrice: integer("sell_price").notNull(),
  stockQty: real("stock_qty").notNull().default(0),
  lowStockThreshold: real("low_stock_threshold").notNull().default(0),
  imageUrl: text("image_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  check("products_prices_non_negative", sql`${table.costPrice} >= 0 AND ${table.sellPrice} >= 0`),
  check("products_stock_non_negative", sql`${table.stockQty} >= 0`),
]);

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  type: text("type", { enum: ["OPENING", "SALE", "RECEIVE", "ADJUSTMENT", "RETURN"] }).notNull(),
  qtyChange: real("qty_change").notNull(),
  qtyAfter: real("qty_after").notNull(),
  reasonCode: text("reason_code"),
  note: text("note"),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNo: text("invoice_no").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  cashierId: integer("cashier_id").notNull().references(() => users.id),
  subtotal: integer("subtotal").notNull(),
  discountType: text("discount_type", { enum: ["PERCENT", "AMOUNT", "NONE"] }).notNull(),
  discountValue: integer("discount_value").notNull(),
  discountTotal: integer("discount_total").notNull(),
  taxRateBp: integer("tax_rate_bp").notNull(),
  taxTotal: integer("tax_total").notNull(),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method", { enum: ["CASH"] }).notNull(),
  amountReceived: integer("amount_received").notNull(),
  changeDue: integer("change_due").notNull(),
  status: text("status", { enum: ["COMPLETED"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  nameSnapshot: text("name_snapshot").notNull(),
  skuSnapshot: text("sku_snapshot").notNull(),
  unitPrice: integer("unit_price").notNull(),
  costSnapshot: integer("cost_snapshot").notNull(),
  qty: real("qty").notNull(),
  lineSubtotal: integer("line_subtotal").notNull(),
  lineDiscount: integer("line_discount").notNull(),
  lineTax: integer("line_tax").notNull(),
  lineTotal: integer("line_total").notNull(),
}, (table) => [check("sale_items_qty_positive", sql`${table.qty} > 0`)]);

export const returns = sqliteTable("returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnNo: text("return_no").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  userId: integer("user_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  refundTotal: integer("refund_total").notNull(),
  refundMethod: text("refund_method", { enum: ["CASH"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const returnItems = sqliteTable("return_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnId: integer("return_id").notNull().references(() => returns.id),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id),
  qty: real("qty").notNull(),
  unitRefund: integer("unit_refund").notNull(),
  refundTotal: integer("refund_total").notNull(),
  restock: integer("restock", { mode: "boolean" }).notNull(),
}, (table) => [check("return_items_qty_positive", sql`${table.qty} > 0`)]);

export const receiptsIn = sqliteTable("receipts_in", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  qty: real("qty").notNull(),
  unitCost: integer("unit_cost").notNull(),
  total: integer("total").notNull(),
  receivedDate: text("received_date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
}, (table) => [check("receipts_in_qty_positive", sql`${table.qty} > 0`)]);

export const photoLookups = sqliteTable("photo_lookups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  visibleText: text("visible_text"),
  candidateIds: text("candidate_ids").notNull(),
  chosenProductId: integer("chosen_product_id").references(() => products.id),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  taxRateBp: integer("tax_rate_bp").notNull().default(0),
  maxDiscountPct: integer("max_discount_pct").notNull().default(20),
  defaultLowStockThreshold: real("default_low_stock_threshold").notNull().default(5),
  currency: text("currency").notNull().default("BDT"),
  storeName: text("store_name").notNull().default("Westlands Store"),
  ...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  stockMovements: many(stockMovements),
}));

export const productsRelations = relations(products, ({ many }) => ({
  stockMovements: many(stockMovements),
  saleItems: many(saleItems),
  receiptsIn: many(receiptsIn),
}));

export const salesRelations = relations(sales, ({ many, one }) => ({
  cashier: one(users, { fields: [sales.cashierId], references: [users.id] }),
  items: many(saleItems),
  returns: many(returns),
}));

export const returnsRelations = relations(returns, ({ many, one }) => ({
  sale: one(sales, { fields: [returns.saleId], references: [sales.id] }),
  items: many(returnItems),
}));
