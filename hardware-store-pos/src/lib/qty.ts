export const QTY_SCALE = 1000;

export function roundQty(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Quantity must be a finite, non-negative number.");
  }

  return Math.round(value * QTY_SCALE) / QTY_SCALE;
}

export function addQty(left: number, right: number): number {
  return roundQty(left + right);
}
