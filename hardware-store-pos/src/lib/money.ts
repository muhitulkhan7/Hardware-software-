export type Money = number;

export function roundMoney(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new Error("Money values must be finite.");
  }

  return Math.round(value);
}

export function formatMoney(amount: Money, currency = "BDT"): string {
  return `${currency} ${amount.toLocaleString("en-BD")}`;
}

export function calculateTax(base: Money, taxRateBp: number): Money {
  return roundMoney((base * taxRateBp) / 10_000);
}
