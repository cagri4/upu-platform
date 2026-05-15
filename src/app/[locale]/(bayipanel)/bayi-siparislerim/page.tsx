"use client";

/**
 * Siparişlerim — bayi sipariş listesi (Sprint B-2 banking primitives refactor).
 *
 * URL: /tr/bayi-siparislerim?t=<token>
 *
 * Pattern: emlak liste sayfaları ile aynı görsel dil (HeroBanner + filter chips
 * + search + Skeleton + empty state). Status badge için custom card (ListCard
 * status renkleri için yeterince esnek değil).
 *
 * Filter chip'ler: tümü / bekliyor / hazırlanıyor / kargolandı / teslim edildi
 *                   / iptal — JS-side filter (server q ile birleşik).
 * Üst aksiyon: "+ Sipariş Kaydet" → /tr/bayi-siparis form.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, PlusCircle, Search } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface OrderRow {
  id: string;
  orderNumber: string;
  dealerName: string | null;
  total: number;
  statusName: string | null;
  statusCode: string | null;
  createdAt: string;
}

interface StatusGroup {
  key: string;
  label: string;
  /** Hangi statusCode'ları kapsar (boş = tümü). */
  codes: string[];
  badge: string;
}

const STATUS_GROUPS: StatusGroup[] = [
  { key: "all",        label: "Tümü",          codes: [], badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
  { key: "pending",    label: "Bekliyor",      codes: ["pending"],                                  badge: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  { key: "preparing",  label: "Hazırlanıyor",  codes: ["preparing"],                                badge: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400" },
  { key: "shipped",    label: "Kargolandı",    codes: ["shipped", "in_transit", "delivering"],      badge: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400" },
  { key: "delivered",  label: "Teslim Edildi", codes: ["delivered"],                                badge: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  { key: "cancelled",  label: "İptal",         codes: ["cancelled"],                                badge: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" },
];

const STATUS_CODE_TO_BADGE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of STATUS_GROUPS) {
    for (const c of g.codes) map[c] = g.badge;
  }
  return map;
})();

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
  const [activeStatus, setActiveStatus] = useState<string>("all");

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const url = `/api/bayi-siparis/list?t=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    fetch(url)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı");
        setRows(d.rows || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token, q]);

  // Status filter — client-side
  const filtered = useMemo(() => {
    const g = STATUS_GROUPS.find((x) => x.key === activeStatus);
    if (!g || g.codes.length === 0) return rows;
    return rows.filter((r) => r.statusCode && g.codes.includes(r.statusCode));
  }, [rows, activeStatus]);

  // Filter chip counts — kullanıcıya hızlı durum dağılımı
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const g of STATUS_GROUPS.slice(1)) {
      m[g.key] = rows.filter((r) => r.statusCode && g.codes.includes(r.statusCode)).length;
    }
    return m;
  }, [rows]);

  const ctaHref = token ? `/tr/bayi-siparis?t=${encodeURIComponent(token)}` : "/tr/bayi-siparis";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* HeroBanner */}
      <HeroBanner
        Icon={ClipboardList}
        title="Siparişlerim"
        subtitle="Bayilerinizden gelen siparişleri buradan yönetin."
        ctaLabel="+ Sipariş Kaydet"
        ctaHref={ctaHref}
      />

      {/* Filter chip row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_GROUPS.map((g) => {
          const isActive = activeStatus === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setActiveStatus(g.key)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300"
              }`}
            >
              <span>{g.label}</span>
              <span
                className={`px-1.5 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {counts[g.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2.2} />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Bayi adı veya sipariş no…"
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Liste */}
      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <PlusCircle className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {q || activeStatus !== "all"
              ? "Bu filtre/aramayla eşleşen sipariş yok."
              : "Henüz sipariş yok."}
          </p>
          <a
            href={ctaHref}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition"
          >
            <PlusCircle className="w-4 h-4" strokeWidth={2.2} />
            Sipariş Kaydet
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const badgeCls =
              (o.statusCode && STATUS_CODE_TO_BADGE[o.statusCode]) ||
              "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
            return (
              <div
                key={o.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {o.orderNumber}
                      </span>
                      {o.statusName && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeCls}`}>
                          {o.statusName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {o.dealerName || "—"} · {formatDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {formatTry(o.total)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-4">
          {filtered.length} sipariş gösteriliyor
          {rows.length !== filtered.length && ` (toplam ${rows.length})`}
        </p>
      )}
    </div>
  );
}
