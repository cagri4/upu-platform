"use client";

/**
 * Siparişlerim — bayi sipariş listesi.
 *
 * URL: /tr/bayi-siparislerim?t=<token>
 *
 * Liste row: sipariş no, bayi, tutar, status, tarih.
 * Üst aksiyon: "+ Sipariş Kaydet" → /tr/bayi-siparis form.
 * Arama (q): debounced 350ms — bayi adı, sipariş no üzerinde JS-side filter.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface OrderRow {
  id: string;
  orderNumber: string;
  dealerName: string | null;
  total: number;
  statusName: string | null;
  statusCode: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-700",
  preparing:  "bg-sky-50 text-sky-700",
  shipped:    "bg-indigo-50 text-indigo-700",
  in_transit: "bg-indigo-50 text-indigo-700",
  delivering: "bg-indigo-50 text-indigo-700",
  delivered:  "bg-emerald-50 text-emerald-700",
  cancelled:  "bg-rose-50 text-rose-700",
};

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function SiparislerimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  // Debounce
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const url = `/api/bayi-siparis/list?t=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    fetch(url)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı");
        setRows(d.rows || []);
        setError("");
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token, q]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">📋 Siparişlerim</h1>
            <p className="text-xs text-slate-500 mt-0.5">{rows.length} sipariş</p>
          </div>
          <a
            href={`/tr/bayi-siparis?t=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
          >
            <span>+</span> Sipariş Kaydet
          </a>
        </div>

        <input
          type="search"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="🔍 Bayi adı, sipariş no…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-center text-sm text-slate-500 py-8">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          {q ? "Bu aramayla eşleşen sipariş yok." : "Henüz sipariş yok."}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(o => {
            const badgeCls = (o.statusCode && STATUS_BADGE[o.statusCode]) || "bg-slate-100 text-slate-600";
            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-900 text-sm">{o.orderNumber}</span>
                      {o.statusName && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${badgeCls}`}>
                          {o.statusName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {o.dealerName || "—"} · {formatDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatTry(o.total)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
