"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductForm } from "@/components/product-form";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  unit: string;
  price: number;
  costPrice?: number;
  stock: number;
  threshold: number;
  color: string;
  imageUrl?: string | null;
  isActive?: boolean;
};

type CartLine = Product & { quantity: number };

function WorkspacePanel({ active, filtered, query, setQuery, addToCart, money, openCart, openInventory, role }: {
  active: string;
  filtered: Product[];
  query: string;
  setQuery: (value: string) => void;
  addToCart: (product: Product) => void;
  money: (amount: number) => string;
  openCart: () => void;
  openInventory: () => void;
  role: "ADMIN" | "CASHIER";
}) {
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [operation, setOperation] = useState<"adjust" | "receive" | null>(null);
  const [operationProduct, setOperationProduct] = useState<Product | null>(null);
  const [operationMessage, setOperationMessage] = useState("");
  const [receiveImageUrl, setReceiveImageUrl] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [workspaceData, setWorkspaceData] = useState<unknown>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [settingsDraft, setSettingsDraft] = useState({ storeName: "", taxRateBp: "0", maxDiscountPct: "0", defaultLowStockThreshold: "0" });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [photoResult, setPhotoResult] = useState<{ lookupId: number; candidates: Product[] } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [selectedSale, setSelectedSale] = useState<Record<string, unknown> | null>(null);
  const [saleDetailError, setSaleDetailError] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnMessage, setReturnMessage] = useState("");
  const [returning, setReturning] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  useEffect(() => {
    const reportQuery = active === "Reports" && (reportFrom || reportTo) ? `?${new URLSearchParams({ ...(reportFrom ? { from: reportFrom } : {}), ...(reportTo ? { to: reportTo } : {}) }).toString()}` : "";
    const endpoint = active === "Reports" ? `/api/reports${reportQuery}` : active === "Sales History" ? "/api/sales/history" : active === "Settings" ? "/api/settings" : "";
    if (!endpoint) return;
    fetch(endpoint).then(async (response) => {
      const result: { ok: boolean; data?: unknown; message?: string } = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to load this workspace.");
      setWorkspaceData(result.data ?? {});
      if (active === "Settings" && result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
        const data = result.data as Record<string, unknown>;
        setSettingsDraft({
          storeName: String(data.storeName ?? ""),
          taxRateBp: String(data.taxRateBp ?? 0),
          maxDiscountPct: String(data.maxDiscountPct ?? 0),
          defaultLowStockThreshold: String(data.defaultLowStockThreshold ?? 0),
        });
      }
    }).catch((error: unknown) => setWorkspaceError(error instanceof Error ? error.message : "Unable to load this workspace."));
  }, [active, reportFrom, reportTo]);

  useEffect(() => {
    if (!scanOpen) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    const startScanner = async () => {
      setScanError("");
      const detectorConstructor = (window as unknown as {
        BarcodeDetector?: new () => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
      }).BarcodeDetector;
      if (!detectorConstructor) {
        setScanError("Camera scanning is not supported here. Enter a barcode in the search field.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new detectorConstructor();
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          const detected = await detector.detect(videoRef.current);
          const value = detected[0]?.rawValue;
          if (value) {
            setQuery(value);
            setScanOpen(false);
            return;
          }
          window.setTimeout(() => void scan(), 250);
        };
        void scan();
      } catch (error: unknown) {
        setScanError(error instanceof Error ? error.message : "Unable to access the camera.");
      }
    };
    void startScanner();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scanOpen, setQuery]);

  const lookupPhoto = async (file: File) => {
    setPhotoError("");
    setPhotoResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch("/api/photo-lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: String(reader.result) }) });
        const result: { ok: boolean; data?: { lookupId: number; candidates: Product[] }; message?: string } = await response.json();
        if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Photo lookup failed.");
        setPhotoResult(result.data);
      } catch (error: unknown) {
        setPhotoError(error instanceof Error ? error.message : "Photo lookup failed.");
      }
    };

    reader.readAsDataURL(file);
  };


    const openSale = async (saleId: string) => {
      setSaleDetailError("");
      setReturnMessage("");
      try {
        const response = await fetch(`/api/sales/history/${saleId}`);
        const result: { ok: boolean; data?: Record<string, unknown>; message?: string } = await response.json();
        if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to load the sale.");
        setSelectedSale(result.data);
        const items = result.data.items as Array<Record<string, unknown>>;
        setReturnQuantities(Object.fromEntries(items.map((item) => [String(item.id), String(Math.max(0, Number(item.qty) - Number(item.returnedQty ?? 0)))])));
      } catch (error: unknown) {
        setSaleDetailError(error instanceof Error ? error.message : "Unable to load the sale.");
      }
    };

    const submitReturn = async () => {
      if (!selectedSale || !returnReason.trim()) {
        setReturnMessage("Add a reason before processing the return.");
        return;
      }
      const sale = selectedSale.sale as Record<string, unknown>;
      const items = selectedSale.items as Array<Record<string, unknown>>;
      const lines = items.map((item) => ({
        saleItemId: Number(item.id),
        quantity: Number(returnQuantities[String(item.id)] ?? 0),
        restock: true,
      })).filter((line) => line.quantity > 0);
      if (lines.length === 0) {
        setReturnMessage("All items on this sale have already been returned.");
        return;
      }
      setReturning(true);
      setReturnMessage("");
      try {
        const response = await fetch("/api/returns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ saleId: Number(sale.id), idempotencyKey: crypto.randomUUID(), reason: returnReason, lines }),
        });
        const result: { ok: boolean; data?: { returnNo: string; refundTotal: number }; message?: string } = await response.json();
        if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to process the return.");
        setReturnMessage(`Return ${result.data.returnNo} processed. Refund: ${money(result.data.refundTotal)}.`);
        setReturnReason("");
        await openSale(String(sale.id));
      } catch (error: unknown) {
        setReturnMessage(error instanceof Error ? error.message : "Unable to process the return.");
      } finally {
        setReturning(false);
      }
    };

  if (active === "Point of Sale") {
    return <section className="workspace-view"><div className="welcome-row"><div><p className="eyebrow">TRANSACTION WORKSPACE</p><h1>Point of sale</h1><p className="subhead">Search the catalog and build a cash sale.</p></div><button className="role-badge cart-link" onClick={openCart}>Cash only · Review cart</button></div><div className="panel pos-preview"><div className="pos-toolbar"><div className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product, SKU or barcode" /></div><button className="scan-button" onClick={() => setScanOpen(true)}>▣ Scan</button><label className="photo-button">Take photo<input type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void lookupPhoto(file); }} /></label></div>{photoError && <p className="checkout-error">{photoError}</p>}{photoResult && <div className="photo-results"><strong>Choose a catalog match</strong>{photoResult.candidates.map((candidate) => <button key={candidate.id} onClick={() => { addToCart(candidate); void fetch("/api/photo-lookup", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ lookupId: photoResult.lookupId, chosenProductId: candidate.id }) }); setPhotoResult(null); }}><span>{candidate.name}</span><small>{candidate.sku} · {money(candidate.price)}</small></button>)}</div>}<div className="pos-products">{filtered.map((product) => <button className="pos-product" key={product.id} onClick={() => addToCart(product)}><span className="product-image" style={{ background: product.color }}>▣</span><span><strong>{product.name}</strong><small>{product.sku} · {money(product.price)} · {product.stock} in stock</small></span><Icon name="plus" size={17} /></button>)}</div></div>{scanOpen && <div className="modal-backdrop"><section className="modal-card scanner-card"><div className="panel-heading"><div><p className="eyebrow">BARCODE SCANNER</p><h3>Point at a product barcode</h3></div><button className="close-button" onClick={() => setScanOpen(false)}>×</button></div><video ref={videoRef} className="scanner-video" muted playsInline />{scanError && <p className="checkout-error">{scanError}</p>}<p className="scanner-help">The result will search the catalog automatically.</p></section></div>}</section>;
  }

  if (active === "Inventory") {
    return <section className="workspace-view"><div className="welcome-row"><div><p className="eyebrow">CATALOG</p><h1>Inventory</h1><p className="subhead">Manage products, prices and stock levels.</p></div>{role === "ADMIN" && <div className="inventory-actions"><button className="secondary-action" onClick={() => { setOperation("receive"); setOperationProduct(filtered[0] ?? null); setReceiveImageUrl(""); }}><Icon name="box" /> Receive stock</button><button className="primary-action" onClick={() => setShowProductForm(true)}><Icon name="plus" /> Add product</button></div>}</div><section className="panel inventory-panel"><div className="search-box inventory-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU..." /></div><div className="product-list">{filtered.map((product) => <div className="product-row" key={product.id}><div className="product-image" style={{ background: product.color }}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : "▣"}</div><div className="product-detail"><strong>{product.name}</strong><small>{product.sku} · {product.category} · {product.unit}</small></div><div className="stock-status"><span className={`status-dot ${product.stock === 0 ? "out" : product.stock <= product.threshold ? "low" : ""}`} />{product.stock} in stock<small>Price: {money(product.price)}</small></div>    {role === "ADMIN" && <><button className="secondary-action row-action" onClick={() => setEditingProduct(product)}>Edit</button><button className="secondary-action row-action" onClick={() => { setOperation("adjust"); setOperationProduct(product); }}>Adjust</button></>}</div>)}</div></section>    {(showProductForm || editingProduct) && <div className="modal-backdrop"><section className="modal-card"><div className="panel-heading"><h3>{editingProduct ? "Edit product" : "Add product"}</h3><button className="close-button" onClick={() => { setShowProductForm(false); setEditingProduct(null); }}>×</button></div><ProductForm product={editingProduct ?? undefined} onSaved={() => { setShowProductForm(false); setEditingProduct(null); window.location.reload(); }} /></section></div>}{operation && operationProduct && <div className="modal-backdrop"><section className="modal-card"><div className="panel-heading"><div><p className="eyebrow">{operation === "adjust" ? "STOCK CONTROL" : "INCOMING DELIVERY"}</p><h3>{operation === "adjust" ? "Adjust stock" : "Receive stock"}</h3><p className="subhead">{operationProduct.name} · {operationProduct.stock} currently in stock</p></div><button className="close-button" onClick={() => setOperation(null)}>×</button></div><form className="modal-form" onSubmit={(event) => { event.preventDefault(); setOperationMessage(""); const form = new FormData(event.currentTarget); const body = operation === "adjust" ? { productId: operationProduct.id, mode: "DELTA", value: Number(form.get("value")), reasonCode: String(form.get("reasonCode")), note: String(form.get("note") ?? "") } : { productId: Number(form.get("productId")), supplierName: String(form.get("supplierName")), quantity: Number(form.get("quantity")), unitCost: Number(form.get("unitCost")), receivedDate: String(form.get("receivedDate")), imageUrl: receiveImageUrl || undefined }; void fetch(operation === "adjust" ? "/api/products/adjust" : "/api/receiving", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (response) => { const result: { ok: boolean; message?: string } = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to save stock movement."); setOperationMessage("Saved."); window.setTimeout(() => window.location.reload(), 350); }).catch((error: unknown) => setOperationMessage(error instanceof Error ? error.message : "Unable to save stock movement.")); }}>{operation === "adjust" ? <><label>Change in quantity<input name="value" type="number" step="0.01" required placeholder="Use a negative number to remove stock" /></label><label>Reason<select name="reasonCode" defaultValue="COUNT_CORRECTION"><option value="COUNT_CORRECTION">Count correction</option><option value="DAMAGE">Damage</option><option value="LOSS">Loss</option><option value="FOUND">Found</option><option value="OTHER">Other</option></select></label><label>Note<input name="note" maxLength={250} /></label></> : <><label>Product<select name="productId" defaultValue={String(operationProduct.id)}>{filtered.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label><label>Supplier name<input name="supplierName" required minLength={2} /></label><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required /></label><label>Unit cost (BDT)<input name="unitCost" type="number" min="0" step="1" required /></label>    <label>Received date<input name="receivedDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Product picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { setOperationMessage("Image must be 2 MB or smaller."); return; } const reader = new FileReader(); reader.onload = () => setReceiveImageUrl(String(reader.result)); reader.readAsDataURL(file); }} /></label></>}<button className="primary-action" type="submit">Save movement</button>{operationMessage && <p className="settings-message">{operationMessage}</p>}</form></section></div>}</section>;
  }

  const descriptions: Record<string, string> = {
    "Sales History": "Review completed transactions and returns.",
    Reports: "Track net sales, refunds and gross profit.",
    Settings: "Configure tax, discounts and store details.",
  };
  const reportData = (workspaceData && typeof workspaceData === "object" && !Array.isArray(workspaceData)) ? workspaceData as Record<string, unknown> : {};
  const historyRows = Array.isArray(workspaceData) ? workspaceData as Array<Record<string, unknown>> : [];
  const bestSellers = Array.isArray(reportData.bestSellers) ? reportData.bestSellers as Array<Record<string, unknown>> : [];
  const lowStockRows = Array.isArray(reportData.lowStock) ? reportData.lowStock as Array<Record<string, unknown>> : [];
  return <section className="workspace-view"><div className="welcome-row"><div><p className="eyebrow">WORKSPACE</p><h1>{active}</h1><p className="subhead">{descriptions[active] ?? "This workspace is ready for configuration."}</p></div>{active === "Sales History" && <div className="inventory-actions"><button className="secondary-action" onClick={openInventory}><Icon name="plus" /> Add product</button><button className="primary-action" onClick={() => openCart()}><Icon name="cart" /> New sale</button></div>}</div><section className={`panel ${active === "Settings" || active === "Sales History" ? "settings-panel" : active === "Reports" ? "report-panel" : "empty-workspace"}`}><div className="empty-icon"><Icon name={active === "Reports" ? "chart" : active === "Settings" ? "settings" : "receipt"} /></div>{workspaceError ? <><h3>Unable to load {active.toLowerCase()}</h3><p>{workspaceError}</p></> : !workspaceData ? <><h3>Loading {active.toLowerCase()}...</h3><p>Reading the shared database.</p></> : active === "Reports" ? <div className="report-layout"><div className="report-intro"><div><p className="eyebrow">STORE PERFORMANCE</p><h2>Keep an eye on the numbers that move the store.</h2></div><div className="report-filters"><label>From<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label><label>To<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label><button className="report-clear" onClick={() => { setReportFrom(""); setReportTo(""); }}>Clear</button></div></div><div className="report-metrics"><article className="report-metric-primary"><small>Net sales</small><strong>{money(Number(reportData.netSales ?? 0))}</strong><span>After discounts and refunds</span></article><article><small>Gross profit</small><strong>{money(Number(reportData.grossProfit ?? 0))}</strong><span>Based on recorded cost</span></article><article><small>Transactions</small><strong>{String(reportData.transactions ?? 0)}</strong><span>Completed cash sales</span></article><article><small>Refunds</small><strong>{money(Number(reportData.refunds ?? 0))}</strong><span>{String(reportData.returnedQuantity ?? 0)} items returned</span></article></div><div className="report-columns"><section className="report-section"><div className="report-section-heading"><div><h3>Best sellers</h3><p>Products contributing the most volume</p></div><span>{bestSellers.length} items</span></div>{bestSellers.length === 0 ? <p className="empty-copy">No sales data yet.</p> : bestSellers.map((item, index) => <div className="report-row" key={String(item.productId)}><span className="report-rank">{String(index + 1).padStart(2, "0")}</span><span className="report-row-name">{String(item.name)}<small>{String(item.quantity)} units sold</small></span><b>{money(Number(item.revenue ?? 0))}</b></div>)}</section><section className="report-section report-alerts"><div className="report-section-heading"><div><h3>Stock alerts</h3><p>Items that need a replenishment decision</p></div><span>{lowStockRows.length} items</span></div>{lowStockRows.length === 0 ? <p className="empty-copy">All products are above threshold.</p> : lowStockRows.map((item) => <div className="report-row" key={String(item.id)}><span className={`report-stock-dot ${Number(item.stockQty ?? 0) === 0 ? "out" : ""}`} /><span className="report-row-name">{String(item.name)}<small>Threshold {String(item.threshold ?? 0)}</small></span><b>{String(item.stockQty)} left</b></div>)}</section></div></div> : active === "Sales History" ? <div className="history-list">{historyRows.length === 0 ? <p>No completed sales yet. Start a sale to see it here.</p> : historyRows.map((sale) => <button className="history-row history-row-button" key={String(sale.id)} onClick={() => void openSale(String(sale.id))}><div><strong>{String(sale.invoiceNo)}</strong><small>{String(sale.cashier ?? "Unknown cashier")} · {new Date(String(sale.createdAt)).toLocaleString()}</small></div><b>{money(Number(sale.total ?? 0))}</b><span className="paid">{String(sale.paymentMethod ?? "CASH")}</span></button>)}</div> : <form className="settings-form" onSubmit={(event) => { event.preventDefault(); setSettingsMessage(""); void fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeName: settingsDraft.storeName, taxRateBp: Number(settingsDraft.taxRateBp), maxDiscountPct: Number(settingsDraft.maxDiscountPct), defaultLowStockThreshold: Number(settingsDraft.defaultLowStockThreshold) }) }).then(async (response) => { const result: { ok: boolean; message?: string } = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message ?? "Unable to save settings."); setSettingsMessage("Settings saved."); }).catch((error: unknown) => setSettingsMessage(error instanceof Error ? error.message : "Unable to save settings.")); }}><label>Store name<input value={settingsDraft.storeName} onChange={(event) => setSettingsDraft({ ...settingsDraft, storeName: event.target.value })} /></label><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={Number(settingsDraft.taxRateBp) / 100} onChange={(event) => setSettingsDraft({ ...settingsDraft, taxRateBp: String(Math.round(Number(event.target.value) * 100)) })} /></label><label>Maximum discount (%)<input type="number" min="0" max="100" value={settingsDraft.maxDiscountPct} onChange={(event) => setSettingsDraft({ ...settingsDraft, maxDiscountPct: event.target.value })} /></label><label>Default low-stock threshold<input type="number" min="0" step="0.01" value={settingsDraft.defaultLowStockThreshold} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultLowStockThreshold: event.target.value })} /></label><button className="primary-action" type="submit">Save settings</button>{settingsMessage && <p className="settings-message">{settingsMessage}</p>}</form>}</section>{selectedSale && <div className="modal-backdrop"><section className="modal-card sale-detail-card"><div className="panel-heading"><div><p className="eyebrow">TRANSACTION DETAIL</p><h3>{String((selectedSale.sale as Record<string, unknown>).invoiceNo)}</h3></div><button className="close-button" onClick={() => setSelectedSale(null)}>×</button></div>{saleDetailError ? <p className="checkout-error">{saleDetailError}</p> : <><div className="sale-detail-meta"><span>{new Date(String((selectedSale.sale as Record<string, unknown>).createdAt)).toLocaleString()}</span><strong>{String(selectedSale.returnStatus)}</strong></div><div className="checkout-lines">{(selectedSale.items as Array<Record<string, unknown>>).map((item) => <div className="checkout-line" key={String(item.id)}><div><strong>{String(item.name)}</strong><small>{String(item.sku)} · {String(item.qty)} sold · {String(item.returnedQty ?? 0)} returned</small></div><strong>{money(Number(item.lineTotal))}</strong>{role === "ADMIN" && Number(item.qty) - Number(item.returnedQty ?? 0) > 0 ? <label className="return-quantity">Return<input type="number" min="0" max={String(Number(item.qty) - Number(item.returnedQty ?? 0))} step="0.01" value={returnQuantities[String(item.id)] ?? "0"} onChange={(event) => setReturnQuantities((current) => ({ ...current, [String(item.id)]: event.target.value }))} /></label> : null}</div>)}</div><div className="checkout-total"><span>Total</span><strong>{money(Number((selectedSale.sale as Record<string, unknown>).total))}</strong></div>{role === "ADMIN" && <div className="return-form"><label className="checkout-field">Return reason<input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="e.g. Damaged item" /></label><button className="primary-action" onClick={() => void submitReturn()} disabled={returning}>{returning ? "Processing..." : "Process full return"}</button>{returnMessage && <p className={returnMessage.startsWith("Return ") ? "settings-message" : "checkout-error"}>{returnMessage}</p>}</div>}</>}</section></div>}</section>;
}

const products: Product[] = [
  { id: 1, name: "Cement 42.5N", sku: "CEM-425", category: "Building", unit: "bag", price: 850, stock: 42, threshold: 10, color: "#d9c6a3" },
  { id: 2, name: "PVC Pipe 20mm", sku: "PVC-020", category: "Plumbing", unit: "length", price: 320, stock: 8, threshold: 12, color: "#d7e7ef" },
  { id: 3, name: "Exterior Wall Paint", sku: "PNT-EXT-5L", category: "Paint", unit: "tin", price: 4200, stock: 15, threshold: 5, color: "#d4e4d5" },
  { id: 4, name: "Galvanized Roofing Sheet", sku: "ROOF-GALV", category: "Roofing", unit: "sheet", price: 1850, stock: 0, threshold: 8, color: "#cbd5df" },
  { id: 5, name: "Masonry Trowel", sku: "TLS-TROWEL", category: "Tools", unit: "piece", price: 1100, stock: 24, threshold: 6, color: "#e6d6bd" },
  { id: 6, name: "Wood Screws 50mm", sku: "SCR-WD-50", category: "Hardware", unit: "box", price: 680, stock: 56, threshold: 15, color: "#ddd2c4" },
];

const money = (amount: number) => `BDT ${amount.toLocaleString("en-BD")}`;

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6M10 21a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
    box: "M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8",
    receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8M8 12h8M8 16h5",
    chart: "M4 19V5m0 14h17M8 16v-4m4 4V7m4 9v-6m4 6V4",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.6 7.6 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a8.4 8.4 0 0 0-1.7-1L15 3.5h-4l-.3 2.6a8.4 8.4 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8.4 8.4 0 0 0 1.7 1l.3 2.6h4l.3-2.6a8.4 8.4 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z",
    search: "m20 20-4.5-4.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
    plus: "M12 5v14M5 12h14",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.1",
    clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export default function Home() {
  const router = useRouter();
  const [active, setActive] = useState("Overview");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Product[]>(products);
  const [authChecking, setAuthChecking] = useState(true);
  const [role, setRole] = useState<"ADMIN" | "CASHIER">("ADMIN");
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<{ netSales: number; transactions: number; productCount: number; alerts: Product[]; recentSales: Array<{ invoiceNo: string; total: number; createdAt: string; cashier?: string | null }> } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState("0");
  const [cashReceived, setCashReceived] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ invoiceNo: string; changeDue: number } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSessionAndProducts(): Promise<void> {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionResult: { data: { role: "ADMIN" | "CASHIER"; name: string; email: string } | null } = await sessionResponse.json();
        if (!sessionResult.data) {
          router.replace("/login");
          return;
        }
        if (mounted) {
          setRole(sessionResult.data.role);
          if (sessionResult.data.role === "CASHIER") setActive("Point of Sale");
        }
        if (mounted) {
          setUserName(sessionResult.data.name);
          setUserEmail(sessionResult.data.email);
        }
        const productResponse = await fetch("/api/products");
        const productResult: { data?: Product[] } = await productResponse.json();
        if (mounted && productResult.data) setCatalog(productResult.data);
        const dashboardResponse = await fetch("/api/dashboard");
        const dashboardResult: { data?: typeof dashboardData } = await dashboardResponse.json();
        if (mounted && dashboardResult.data) setDashboardData(dashboardResult.data);
      } finally {
        if (mounted) setAuthChecking(false);
      }
    }
    void loadSessionAndProducts();
    return () => { mounted = false; };
  }, [router]);

  const filtered = useMemo(
    () => catalog.filter((product) => `${product.name} ${product.sku} ${product.barcode ?? ""} ${product.category}`.toLowerCase().includes(query.toLowerCase())),
    [catalog, query],
  );

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      return existing
        ? current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { ...product, quantity: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const lowStock = catalog.filter((product) => product.stock <= product.threshold);
  const updateQuantity = (id: number, delta: number) => setCart((current) => current.flatMap((line) => {
    if (line.id !== id) return [line];
    const quantity = line.quantity + delta;
    return quantity > 0 ? [{ ...line, quantity }] : [];
  }));
  const clearCart = () => {
    if (window.confirm("Clear the current sale?")) setCart([]);
  };
  const checkout = async () => {
    setCheckoutBusy(true);
    setCheckoutError("");
    const cash = Number(cashReceived);
    const discount = Number(discountPct);
    if (!Number.isInteger(cash) || cash < 0 || !Number.isInteger(discount) || discount < 0 || discount > 100) {
      setCheckoutError("Enter valid whole amounts for cash and discount.");
      setCheckoutBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/sales", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          discount: discount > 0 ? { type: "PERCENT", value: discount } : { type: "NONE", value: 0 },
          cashReceived: cash,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result: { ok: boolean; data?: { invoiceNo: string; changeDue: number }; message?: string } = await response.json();
      if (!response.ok || !result.ok || !result.data) throw new Error(result.message ?? "Unable to complete the sale.");
      setCheckoutSuccess(result.data);
      setCart([]);
      setCashReceived("");
      setDiscountPct("0");
      setCatalog((current) => current.map((product) => {
        const sold = cart.find((line) => line.id === product.id);
        return sold ? { ...product, stock: Math.max(0, product.stock - sold.quantity) } : product;
      }));
      const dashboardResponse = await fetch("/api/dashboard");
      const dashboardResult: { data?: typeof dashboardData } = await dashboardResponse.json();
      if (dashboardResult.data) setDashboardData(dashboardResult.data);
    } catch (error: unknown) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to complete the sale.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  if (authChecking) return <main className="loading-screen"><div className="brand"><span className="brand-mark">H</span><span>HARDWARE<span>HUB</span></span></div><p>Loading your workspace...</p></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">H</span><span>HARDWARE<span>HUB</span></span></div>
        <div className="store-switcher"><span className="store-dot" /><div><strong>Westlands Store</strong><small>Open · Main branch</small></div><span className="chevron">⌄</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {(role === "ADMIN" ? ["Overview", "Point of Sale", "Inventory", "Sales History"] : ["Point of Sale", "Inventory", "Sales History"]).map((item, index) => (
            <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}>
              <Icon name={role === "ADMIN" ? ["grid", "cart", "box", "receipt"][index] : ["cart", "box", "receipt"][index]} /> {item}
              {item === "Point of Sale" && cart.length > 0 ? <b className="nav-count">{cart.length}</b> : null}
            </button>
          ))}
          {role === "ADMIN" && <><p className="nav-label nav-space">Insights</p>{["Reports", "Settings"].map((item, index) => <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}><Icon name={index ? "settings" : "chart"} /> {item}</button>)}</>}
        </nav>
        <div className="sidebar-bottom"><button className="help-link">? <span>Help center</span></button><div className="profile"><div className="avatar">{userName.slice(0, 2).toUpperCase()}</div><div><strong>{userName}</strong><small>{role === "ADMIN" ? "Admin" : "Sales"} · Online</small></div><button className="profile-menu-button" onClick={() => setProfileOpen((current) => !current)} aria-label="Open profile menu">•••</button>{profileOpen && <div className="profile-menu"><small>{userEmail}</small><button onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.replace("/login"))}>Log out</button></div>}</div></div>
      </aside>

      <section className="content">
        <header className="topbar"><button className="mobile-menu">☰</button><div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-button"><Icon name="alert" /></button><div className="top-profile"><button className="top-avatar top-profile-button" onClick={() => setProfileOpen((current) => !current)} aria-label="Open profile menu">{userName.slice(0, 2).toUpperCase()}</button>{profileOpen && <div className="profile-menu top-profile-menu"><strong>{userName}</strong><small>{userEmail}</small><small>{role === "ADMIN" ? "Admin" : "Sales"} account</small><button onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.replace("/login"))}>Log out</button></div>}</div></div></header>
        {active === "Overview" ? <div className="page-body">
          <div className="welcome-row"><div><p className="eyebrow">TODAY AT WESTLANDS STORE</p><h1>Good morning, {userName.split(" ")[0]} <span>✦</span></h1><p className="subhead">Here&apos;s what&apos;s happening at Westlands Store today.</p></div><button className="primary-action" onClick={() => setActive("Point of Sale")}><Icon name="plus" /> New sale</button></div>

          <div className="stats-grid">
            <article className="stat-card"><div className="stat-icon indigo"><Icon name="chart" /></div><div><p>Today&apos;s net sales</p><h2>{dashboardData ? money(dashboardData.netSales) : "Loading..."}</h2><span className="positive">Live from sales</span></div><span className="card-menu">•••</span></article>
            <article className="stat-card"><div className="stat-icon mint"><Icon name="receipt" /></div><div><p>Transactions</p><h2>{dashboardData?.transactions ?? "Loading..."}</h2><span className="positive">Live from sales</span></div><span className="card-menu">•••</span></article>
            <article className="stat-card"><div className="stat-icon amber"><Icon name="box" /></div><div><p>Products in stock</p><h2>{dashboardData?.productCount ?? "Loading..."}</h2><span className="positive">Active catalog</span></div><span className="card-menu">•••</span></article>
            <article className="stat-card"><div className="stat-icon rose"><Icon name="alert" /></div><div><p>Stock alerts</p><h2>{lowStock.length}</h2><span className="muted">Needs attention</span></div><span className="card-menu">•••</span></article>
          </div>

          <div className="main-grid">
            <section className="panel sales-panel"><div className="panel-heading"><div><h3>Sales overview</h3><p>Daily performance for the last 7 days</p></div><button className="select-button">This week <span>⌄</span></button></div><div className="chart"><div className="chart-y"><span>40k</span><span>30k</span><span>20k</span><span>10k</span><span>0</span></div><div className="chart-area"><div className="grid-lines" /><svg viewBox="0 0 700 220" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity=".22" /><stop offset="1" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs><path d="M0 176 C35 172 55 142 100 151 S160 185 200 128 S260 102 300 122 S370 80 400 103 S450 143 500 89 S555 80 600 65 S660 86 700 38 L700 220 L0 220Z" fill="url(#fill)" /><path d="M0 176 C35 172 55 142 100 151 S160 185 200 128 S260 102 300 122 S370 80 400 103 S450 143 500 89 S555 80 600 65 S660 86 700 38" fill="none" stroke="#6366f1" strokeWidth="3" /></svg><div className="chart-days"><span>Fri 17</span><span>Sat 18</span><span>Sun 19</span><span>Mon 20</span><span>Tue 21</span><span>Wed 22</span><span>Today</span></div></div></div></section>
            <section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common tasks, one click away</p></div></div><div className="quick-actions"><button onClick={() => setActive("Point of Sale")}><span className="quick-icon purple"><Icon name="cart" /></span><span><strong>New sale</strong><small>Open the point of sale</small></span><Icon name="arrow" /></button><button><span className="quick-icon orange"><Icon name="plus" /></span><span><strong>Add product</strong><small>Create a new inventory item</small></span><Icon name="arrow" /></button><button><span className="quick-icon blue"><Icon name="box" /></span><span><strong>Receive stock</strong><small>Record an incoming delivery</small></span><Icon name="arrow" /></button></div></section>
          </div>

          <div className="lower-grid"><section className="panel inventory-panel"><div className="panel-heading"><div><h3>Inventory watchlist</h3><p>Products that need your attention</p></div><button className="text-button" onClick={() => setActive("Inventory")}>View inventory <Icon name="arrow" size={15} /></button></div><div className="product-list">{lowStock.map((product) => <div className="product-row" key={product.id}><div className="product-image" style={{ background: product.color }}>{product.category === "Roofing" ? "▱" : product.category === "Plumbing" ? "◯" : "▣"}</div><div className="product-detail"><strong>{product.name}</strong><small>{product.sku} · {product.unit}</small></div><div className="stock-status"><span className={`status-dot ${product.stock === 0 ? "out" : "low"}`} />{product.stock === 0 ? "Out of stock" : `${product.stock} left`}<small>Threshold: {product.threshold}</small></div><button className="row-menu">•••</button></div>)}</div></section>          <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent sales</h3><p>Latest transactions from the shared database</p></div><button className="text-button" onClick={() => setActive("Sales History")}>View all <Icon name="arrow" size={15} /></button></div><div className="recent-list">{dashboardData?.recentSales.length ? dashboardData.recentSales.map((sale) => <div className="recent-row" key={sale.invoiceNo}><div className="receipt-mini"><Icon name="receipt" size={16} /></div><div><strong>{sale.invoiceNo}</strong><small>{sale.cashier ?? "Cashier"} · {new Date(sale.createdAt).toLocaleTimeString()}</small></div><b>{money(sale.total)}</b><span className="paid">Paid</span></div>) : <p className="empty-copy">No sales recorded yet.</p>}</div></section></div>

          <section className="panel pos-preview"><div className="panel-heading"><div><h3>Point of sale</h3><p>Search your catalog and add items to the current sale.</p></div><span className="role-badge">Cash only</span></div><div className="pos-toolbar"><div className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product, SKU or barcode..." /></div><button className="scan-button">▣ Scan</button><span className="cart-summary">{cart.length} items · <strong>{money(cartTotal)}</strong></span></div><div className="pos-products">{filtered.slice(0, 4).map((product) => <button className="pos-product" key={product.id} onClick={() => addToCart(product)}><span className="product-image" style={{ background: product.color }}>{product.category === "Roofing" ? "▱" : "▣"}</span><span><strong>{product.name}</strong><small>{product.sku} · {money(product.price)}</small></span><Icon name="plus" size={17} /></button>)}</div></section>
          </div>
        : <div className="page-body"><WorkspacePanel active={active} filtered={filtered} query={query} setQuery={setQuery} addToCart={addToCart} money={money} openCart={() => setCartOpen(true)} openInventory={() => setActive("Inventory")} role={role} /></div>}
      </section>
      {cart.length > 0 && <div className="floating-cart"><span><b>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</b> in current sale</span><strong>{money(cartTotal)}</strong><button onClick={() => setCartOpen(true)}>Review cart <Icon name="arrow" size={16} /></button></div>}
      {cartOpen && <div className="modal-backdrop"><section className="modal-card checkout-card">
        <div className="panel-heading"><div><p className="eyebrow">CURRENT SALE</p><h3>Review and take payment</h3></div><button className="close-button" onClick={() => setCartOpen(false)}>×</button></div>
        {checkoutSuccess ? <div className="checkout-success"><div className="success-mark">✓</div><h3>Sale complete</h3><p>{checkoutSuccess.invoiceNo}</p><strong>Change due: {money(checkoutSuccess.changeDue)}</strong><button className="primary-action" onClick={() => { setCheckoutSuccess(null); setCartOpen(false); }}>Done</button></div> : <>
          <div className="checkout-lines">{cart.map((line) => <div className="checkout-line" key={line.id}><div><strong>{line.name}</strong><small>{money(line.price)} each</small></div><div className="qty-control"><button onClick={() => updateQuantity(line.id, -1)} aria-label={`Decrease ${line.name}`}>−</button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.id, 1)} aria-label={`Increase ${line.name}`}>+</button></div><strong>{money(line.price * line.quantity)}</strong></div>)}</div>
          <div className="checkout-total"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
          <label className="checkout-field">Discount %<input type="number" min="0" max="100" value={discountPct} onChange={(event) => setDiscountPct(event.target.value)} /></label>
          <label className="checkout-field">Cash received (BDT)<input type="number" min="0" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0" /></label>
          {checkoutError && <p className="checkout-error">{checkoutError}</p>}
          <div className="checkout-actions"><button className="secondary-action" onClick={clearCart}>Clear sale</button><button className="primary-action" disabled={checkoutBusy || cart.length === 0} onClick={() => void checkout()}>{checkoutBusy ? "Processing..." : "Complete cash sale"}</button></div>
        </>}
      </section></div>}
    </main>
  );
}
