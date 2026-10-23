import { describe, expect, it } from "vitest";
import { calculateTax } from "@/lib/money";
import { getReturnStatus, getStockStatus } from "@/lib/status";
import { quoteSale } from "@/server/services/sale";

describe("foundation business rules", () => {
  it("computes tax in integer minor units", () => {
    expect(calculateTax(1_999, 1_600)).toBe(320);
  });

  it("handles stock status boundaries", () => {
    expect(getStockStatus(0, 5)).toBe("OUT_OF_STOCK");
    expect(getStockStatus(5, 5)).toBe("LOW_STOCK");
    expect(getStockStatus(6, 5)).toBe("IN_STOCK");
  });

  it("derives return status without mutating sale data", () => {
    expect(getReturnStatus(3, 0)).toBe("COMPLETED");
    expect(getReturnStatus(3, 1)).toBe("PARTIALLY_RETURNED");
    expect(getReturnStatus(3, 3)).toBe("FULLY_RETURNED");
  });

  it("allocates a discount while preserving the total", () => {
    const result = quoteSale(
      [
        { id: 1, name: "Screws", sku: "SCR-1", sellPrice: 101, stockQty: 10, isActive: true },
        { id: 2, name: "Nails", sku: "NAIL-1", sellPrice: 101, stockQty: 10, isActive: true },
      ],
      [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }],
      { type: "PERCENT", value: 10 },
      0,
    );
    expect(result).toMatchObject({ ok: true, data: { subtotal: 202, discountTotal: 20, total: 182 } });
    if (result.ok) expect(result.data.lines.reduce((sum, line) => sum + line.lineDiscount, 0)).toBe(20);
  });

  it("rejects insufficient stock before a sale is written", () => {
    const result = quoteSale(
      [{ id: 1, name: "Cement", sku: "CEM", sellPrice: 100, stockQty: 1, isActive: true }],
      [{ productId: 1, quantity: 2 }],
      { type: "NONE", value: 0 },
    );
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_STOCK" });
  });

  it("rejects inactive products", () => {
    const result = quoteSale(
      [{ id: 1, name: "Inactive", sku: "OLD", sellPrice: 100, stockQty: 2, isActive: false }],
      [{ productId: 1, quantity: 1 }],
      { type: "NONE", value: 0 },
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});
