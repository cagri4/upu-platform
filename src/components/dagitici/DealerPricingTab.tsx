"use client";

/**
 * Bayi detay sayfasının "Fiyat" sekmesi — bu bayiye atanmış fiyat
 * listelerini gösterir + ekle/öncelik düzenle/kaldır.
 *
 * "Hızlı test" widget'ı: ürün + miktar gir → resolveDealerPrice() ile birim
 * fiyat ve uygulanan iskonto görüntüler (manuel doğrulama için).
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";

interface AssignedRow {
  id: string;
  priceListId: string;
  priority: number;
  name: string;
  description: string | null;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  currency: string;
}

interface ListOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface ResolveResult {
  basePrice: number;
  unitPrice: number;
  finalPrice: number;
  discountPercent: number;
  currency: string;
  priceListId: string | null;
  priceListName: string | null;
  source: string;
}

const formatPara = (n: number, c: string = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(n);

export function DealerPricingTab({ dealerId }: { dealerId: string }) {
  const [rows, setRows] = useState<AssignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allLists, setAllLists] = useState<ListOption[]>([]);
  const [newListId, setNewListId] = useState("");
  const [newPriority, setNewPriority] = useState("100");
  const [adding, setAdding] = useState(false);

  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [testProduct, setTestProduct] = useState("");
  const [testQty, setTestQty] = useState("1");
  const [testResult, setTestResult] = useState<ResolveResult | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, lRes, pRes] = await Promise.all([
        fetch(`/api/dagitici/bayiler/${dealerId}/fiyat-listeleri`, {
          credentials: "same-origin",
        }),
        fetch("/api/dagitici/fiyat-listeleri?status=active", {
          credentials: "same-origin",
        }),
        fetch("/api/dagitici/urunler?status=active&pageSize=100", {
          credentials: "same-origin",
        }),
      ]);
      const aData = await aRes.json();
      const lData = await lRes.json();
      const pData = await pRes.json();
      if (!aRes.ok || !aData.success) {
        setError(aData.error || "Yüklenemedi.");
        return;
      }
      setRows(aData.items || []);
      const assignedIds = new Set((aData.items || []).map((r: { priceListId: string }) => r.priceListId));
      setAllLists(
        (lData.items || [])
          .filter((l: { id: string }) => !assignedIds.has(l.id))
          .map((l: { id: string; name: string; isActive: boolean }) => ({
            id: l.id,
            name: l.name,
            isActive: l.isActive,
          })),
      );
      setProductOptions(
        (pData.items || []).map((p: { id: string; code: string; name: string }) => ({
          id: p.id,
          code: p.code,
          name: p.name,
        })),
      );
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [dealerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!newListId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/dagitici/bayiler/${dealerId}/fiyat-listeleri`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_list_id: newListId, priority: Number(newPriority) }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Atama yapılamadı.");
        return;
      }
      setNewListId("");
      setNewPriority("100");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdatePriority(row: AssignedRow, newPri: number) {
    const res = await fetch(`/api/dagitici/bayiler/${dealerId}/fiyat-listeleri`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_id: row.priceListId, priority: newPri }),
    });
    if (res.ok) load();
  }

  async function handleRemove(row: AssignedRow) {
    if (!confirm(`"${row.name}" ataması kaldırılsın mı?`)) return;
    await fetch(
      `/api/dagitici/bayiler/${dealerId}/fiyat-listeleri?price_list_id=${row.priceListId}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    load();
  }

  async function handleTestResolve() {
    if (!testProduct) {
      alert("Ürün seç.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const sp = new URLSearchParams({
        dealer_id: dealerId,
        product_id: testProduct,
        miktar: testQty,
      });
      const res = await fetch(`/api/dagitici/fiyat-resolve?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Hesaplanamadı.");
        return;
      }
      setTestResult(d as ResolveResult);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Atanmış listeler — 2/3 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Atanmış Fiyat Listeleri ({rows.length})
          </h3>
          <p className="text-xs text-slate-500">
            Düşük öncelik (priority) önce kontrol edilir. İlk eşleşen liste kullanılır.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Atanmış liste yok. Sağdaki paneldan ata.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.description || "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {r.isActive ? (
                    <StatusBadge tone="success">Aktif</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Pasif</StatusBadge>
                  )}
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Öncelik</span>
                    <input
                      type="number"
                      value={r.priority}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setRows((arr) =>
                          arr.map((x) => (x.id === r.id ? { ...x, priority: v } : x)),
                        );
                      }}
                      onBlur={(e) => handleUpdatePriority(r, Number(e.target.value))}
                      className="h-7 w-16 rounded-md border border-slate-200 bg-white px-1.5 text-xs tabular-nums focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={() => handleRemove(r)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-xs font-medium text-slate-700">Yeni Atama</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <select
              value={newListId}
              onChange={(e) => setNewListId(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Liste seç —</option>
              {allLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              placeholder="Öncelik"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newListId}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Ata
            </button>
          </div>
        </div>
        {error && (
          <p className="px-5 py-2 text-sm text-rose-700">{error}</p>
        )}
      </div>

      {/* Hızlı test paneli — 1/3 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calculator className="h-4 w-4" /> Hızlı Test
          </h3>
          <p className="text-xs text-slate-500">
            Bu bayi için belirli ürün ve miktarda fiyat motor sonucu.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Ürün</span>
            <select
              value={testProduct}
              onChange={(e) => setTestProduct(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Seç —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Miktar</span>
            <input
              type="number"
              min={1}
              value={testQty}
              onChange={(e) => setTestQty(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <button
            onClick={handleTestResolve}
            disabled={testing || !testProduct}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {testing ? "Hesaplanıyor…" : "Fiyatı Hesapla"}
          </button>

          {testResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Sonuç:</p>
              <div className="mt-2 space-y-1 text-sm tabular-nums">
                <p className="flex justify-between">
                  <span className="text-slate-500">Varsayılan</span>
                  <span>{formatPara(testResult.basePrice, testResult.currency)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Liste fiyatı</span>
                  <span>{formatPara(testResult.unitPrice, testResult.currency)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">İskonto</span>
                  <span>%{testResult.discountPercent}</span>
                </p>
                <p className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-emerald-700">
                  <span>Final birim</span>
                  <span>{formatPara(testResult.finalPrice, testResult.currency)}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Kaynak: {testResult.priceListName || testResult.source}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
