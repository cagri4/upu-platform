"use client";

/**
 * Bayi detay sayfasında "Bu bayiye öner" widget.
 * `/api/bayi-cross-sell/list?dealer_id=` — bayinin son 6 ay siparişine
 * göre top 5 ürün önerisi. Stok > 0 olanlar öncelikte.
 */
import { useEffect, useState } from "react";

interface Suggestion {
  product_id: string;
  name?: string;
  code?: string | null;
  unit_price?: number;
  stock_quantity?: number;
  score: number;
  count: number;
  dealer_count: number;
}

function fmtTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export function CrossSellSuggestions({ dealerId, token = "" }: { dealerId: string; token?: string }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams({ dealer_id: dealerId, limit: "5" });
    if (token) qs.set("t", token);
    fetch(`/api/bayi-cross-sell/list?${qs.toString()}`, { credentials: "same-origin" })
      .then(r => {
        if (r.status === 403) { setHidden(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d?.pairs) setItems(d.pairs); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [dealerId, token]);

  if (hidden || loading) return null;
  if (!items || items.length === 0) return null;

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">💡 Bu Bayiye Öner</h3>
        <span className="text-[10px] text-slate-400">Yapay zekâ — co-occurrence</span>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const lowStock = (item.stock_quantity || 0) <= 0;
          return (
            <div key={item.product_id} className={`flex items-center justify-between gap-3 p-2 rounded-lg border ${lowStock ? "border-amber-200 bg-amber-50/40" : "border-slate-100 dark:border-slate-800/50"}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || "(silinmiş)"}</div>
                <div className="text-[11px] text-slate-500 flex gap-2">
                  {item.code && <span className="font-mono">{item.code}</span>}
                  <span>{item.dealer_count} bayide ortak alındı</span>
                  {lowStock && <span className="text-amber-700 font-medium">⚠ Stokta yok</span>}
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.unit_price ? fmtTry(item.unit_price) : "—"}
                </div>
                <div className="text-[10px] text-slate-400">skor {Math.round(item.score)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
