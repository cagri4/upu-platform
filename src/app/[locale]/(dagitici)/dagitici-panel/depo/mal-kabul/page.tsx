"use client";

/**
 * Dağıtıcı — Mal kabul (tedarikçiden stok girişi) + geçmiş (Faz 5).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Warehouse { id: string; name: string; isActive: boolean }
interface Product { id: string; code: string; name: string }
interface ReceiveRow {
  id: string;
  productName: string;
  warehouse: string;
  quantity: number;
  supplierName: string | null;
  createdAt: string;
}

export default function MalKabulPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<ReceiveRow[]>([]);
  const [whId, setWhId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/dagitici/depo/mal-kabul", { credentials: "same-origin" });
    const d = await res.json();
    if (d.success) setHistory(d.items);
  }, []);

  useEffect(() => {
    (async () => {
      const [w, p] = await Promise.all([
        fetch("/api/dagitici/depo", { credentials: "same-origin" }).then((r) => r.json()),
        fetch("/api/dagitici/urunler?pageSize=200", { credentials: "same-origin" }).then((r) => r.json()),
      ]);
      if (w.success) setWarehouses(w.items.filter((x: Warehouse) => x.isActive));
      if (p.success) setProducts(p.items.map((x: { id: string; code: string; name: string }) => ({ id: x.id, code: x.code, name: x.name })));
      void loadHistory();
    })();
  }, [loadHistory]);

  const submit = async () => {
    setMsg(null);
    if (!whId || !productId || !qty) {
      setMsg({ ok: false, text: "Depo, ürün ve adet zorunlu." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dagitici/depo/mal-kabul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: whId,
          product_id: productId,
          quantity: Number(qty),
          supplier_name: supplier.trim() || undefined,
          batch: batch.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setMsg({ ok: false, text: d.error || "Giriş başarısız." });
        return;
      }
      const warn = d.aboveMax ? ` ⚠️ Fazla stok (max ${d.maxThreshold}).` : "";
      setMsg({ ok: true, text: `Giriş yapıldı. Depo stoğu: ${d.warehouseQty}.${warn}` });
      setQty("");
      setBatch("");
      void loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<ReceiveRow>[] = useMemo(
    () => [
      { key: "product", header: "Ürün", render: (r) => <span className="font-medium">{r.productName}</span> },
      { key: "wh", header: "Depo", render: (r) => <span className="text-slate-600">{r.warehouse}</span> },
      { key: "qty", header: "Adet", align: "right", render: (r) => <span className="tabular-nums font-medium">+{r.quantity}</span> },
      { key: "supplier", header: "Tedarikçi", render: (r) => <span className="text-slate-500">{r.supplierName || "—"}</span> },
      { key: "date", header: "Tarih", render: (r) => <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</span> },
    ],
    [],
  );

  const fld = "h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white";

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/depo`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Depolar
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mal Kabul</h1>
        {isBayiFeatureEnabled("bayi.satinalma") && (
          <Link href={`/${locale}/dagitici-panel/satinalma`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <PackagePlus className="h-4 w-4" /> PO&apos;dan Mal Kabul
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Depo
            <select value={whId} onChange={(e) => setWhId(e.target.value)} className={fld}>
              <option value="">Seç…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Ürün
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={fld}>
              <option value="">Seç…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Adet
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={fld} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Tedarikçi (opsiyonel)
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={fld} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Batch (opsiyonel)
            <input value={batch} onChange={(e) => setBatch(e.target.value)} className={fld} />
          </label>
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        <button onClick={submit} disabled={busy} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          <PackagePlus className="h-4 w-4" /> {busy ? "İşleniyor…" : "Stoğa Al"}
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Son Mal Kabuller</h2>
        <DataTable rows={history} columns={columns} rowKey={(r) => r.id} emptyText="Henüz mal kabul yok." />
      </div>
    </div>
  );
}
