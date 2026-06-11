"use client";

/**
 * Dağıtıcı — Depolar arası transfer (Faz 5).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Warehouse { id: string; name: string; isActive: boolean }
interface Product { id: string; code: string; name: string }
interface TransferRow {
  id: string;
  fromWarehouse: string;
  toWarehouse: string;
  productCode: string;
  productName: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export default function TransferPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<TransferRow[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/dagitici/depo/transfer", { credentials: "same-origin" });
    const d = await res.json();
    if (d.success) setHistory(d.items);
  }, []);

  useEffect(() => {
    (async () => {
      const [wRes, pRes] = await Promise.all([
        fetch("/api/dagitici/depo", { credentials: "same-origin" }).then((r) => r.json()),
        fetch("/api/dagitici/urunler?pageSize=200", { credentials: "same-origin" }).then((r) => r.json()),
      ]);
      if (wRes.success) setWarehouses(wRes.items.filter((w: Warehouse) => w.isActive));
      if (pRes.success) setProducts(pRes.items.map((p: { id: string; code: string; name: string }) => ({ id: p.id, code: p.code, name: p.name })));
      void loadHistory();
    })();
  }, [loadHistory]);

  const submit = async () => {
    setMsg(null);
    if (!fromId || !toId || !productId || !qty) {
      setMsg({ ok: false, text: "Tüm alanları doldur." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/depo/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          product_id: productId,
          quantity: Number(qty),
          reason: reason.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setMsg({ ok: false, text: d.error || "Transfer başarısız." });
        return;
      }
      setMsg({ ok: true, text: "Transfer tamamlandı." });
      setQty("");
      setReason("");
      void loadHistory();
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<TransferRow>[] = useMemo(
    () => [
      { key: "product", header: "Ürün", render: (r) => <span className="font-medium">{r.productName}</span> },
      { key: "route", header: "Aktarım", render: (r) => <span className="text-slate-600">{r.fromWarehouse} → {r.toWarehouse}</span> },
      { key: "qty", header: "Adet", align: "right", render: (r) => <span className="tabular-nums font-medium">{r.quantity}</span> },
      { key: "date", header: "Tarih", render: (r) => <span className="text-slate-500">{new Date(r.createdAt).toLocaleString("tr-TR")}</span> },
    ],
    [],
  );

  const sel = "h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white";

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/depo`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Depolar
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Depolar Arası Transfer</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Kaynak Depo
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={sel}>
              <option value="">Seç…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Hedef Depo
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={sel}>
              <option value="">Seç…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Ürün
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={sel}>
              <option value="">Seç…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Adet
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={sel} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 sm:col-span-2">
            Neden (opsiyonel)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Şube talebi, denge…" className={sel} />
          </label>
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        <button onClick={submit} disabled={saving} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          <ArrowLeftRight className="h-4 w-4" /> {saving ? "Aktarılıyor…" : "Transfer Et"}
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Transfer Geçmişi</h2>
        <DataTable rows={history} columns={columns} rowKey={(r) => r.id} emptyText="Henüz transfer yok." />
      </div>
    </div>
  );
}
