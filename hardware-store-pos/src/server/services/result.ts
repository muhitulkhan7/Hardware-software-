export type ServiceErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INSUFFICIENT_STOCK"
  | "INSUFFICIENT_PAYMENT"
  | "DISCOUNT_TOO_HIGH"
  | "DUPLICATE_SKU"
  | "OVER_RETURN";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceErrorCode; message: string; fieldErrors?: Record<string, string[]> };
