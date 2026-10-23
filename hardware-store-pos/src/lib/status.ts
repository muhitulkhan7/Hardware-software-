export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type ReturnStatus = "COMPLETED" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";

export function getStockStatus(stockQty: number, lowStockThreshold: number): StockStatus {
  if (stockQty < 0 || lowStockThreshold < 0) {
    throw new Error("Stock values cannot be negative.");
  }

  if (stockQty === 0) return "OUT_OF_STOCK";
  if (stockQty <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export function getReturnStatus(soldQty: number, returnedQty: number): ReturnStatus {
  if (soldQty <= 0 || returnedQty < 0 || returnedQty > soldQty) {
    throw new Error("Return quantity must be within the sold quantity.");
  }

  if (returnedQty === soldQty) return "FULLY_RETURNED";
  if (returnedQty > 0) return "PARTIALLY_RETURNED";
  return "COMPLETED";
}
