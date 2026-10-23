"use client";

import { useState } from "react";

type ProductFormValue = { id: number; name: string; sku: string; barcode?: string | null; category: string; unit: string; costPrice?: number; price: number; stock: number; threshold: number; imageUrl?: string | null; isActive?: boolean };

export function ProductForm({ onSaved, product }: { onSaved: () => void; product?: ProductFormValue }) {
  const [form, setForm] = useState({ name: product?.name ?? "", sku: product?.sku ?? "", barcode: product?.barcode ?? "", category: product?.category ?? "Hardware", unit: product?.unit ?? "piece", costPrice: String(product?.costPrice ?? 0), sellPrice: String(product?.price ?? 0), openingStock: "0", lowStockThreshold: String(product?.threshold ?? 5), imageUrl: product?.imageUrl ?? "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setPending(true); setError("");
    const response = await fetch(product ? `/api/products/${product.id}` : "/api/products/create", { method: product ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, costPrice: Number(form.costPrice), sellPrice: Number(form.sellPrice), openingStock: Number(form.openingStock), lowStockThreshold: Number(form.lowStockThreshold), isActive: product?.isActive ?? true }) });
    const result: { ok: boolean; message?: string } = await response.json();
    if (!result.ok) setError(result.message ?? "Unable to create product."); else onSaved();
    setPending(false);
  }
  return <form className="modal-form" onSubmit={submit}><div className="form-grid">{(["name", "sku", "barcode", "category", "unit", "costPrice", "sellPrice", "openingStock", "lowStockThreshold"] as const).map((key) => <label key={key}>{key.replace(/([A-Z])/g, " $1")}<input required={key !== "barcode"} inputMode={["costPrice", "sellPrice", "openingStock", "lowStockThreshold"].includes(key) ? "decimal" : undefined} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}<label>Product image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { setError("Image must be 2 MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => update("imageUrl", String(reader.result)); reader.readAsDataURL(file); }} /></label></div>{form.imageUrl && <img className="product-preview" src={form.imageUrl} alt="Product preview" />}{error && <p className="login-error">{error}</p>}<button className="primary-action" disabled={pending}>{pending ? "Saving..." : "Save product"}</button></form>;
}
