/**
 * /bayiler — bayi listesi web paneli (magic-link auth, paginated).
 *
 * URL: /[locale]/bayiler?t=<token>&page=1&q=&status=aktif&vade=tum&pageSize=20
 *
 * Liste row tasarımı:
 *   - Avatar/baş harf
 *   - İsim + şehir
 *   - Telefon (tap-to-call)
 *   - Etiket (KRİTİK kırmızı / Bekleyen sarı / Temiz yeşil / Pasif gri)
 *   - Bakiye + son sipariş tarihi
 *   - 3 hızlı aksiyon: 📩 WA | 📞 Ara | ⋮ Daha
 *
 * Liste row tıklanır → /bayiler/[id] detay.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface BayiRow {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  balance: number;
  lastOrderId: string | null;
  lastOrderDate: string | null;
  lastOrderTotal: number;
  criticalDays: number | null;
  isCritical: boolean;
}

interface ListResp {
  rows: BayiRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

interface InitResp {
  user: {
    displayName: string | null;
    sektor: string;
    ticariUnvan: string;
    capabilities: string[];
  };
}

const STATUS_OPTIONS = [
  { id: "aktif",  label: "Aktif" },
  { id: "pasif",  label: "Pasif" },
  { id: "tum",    label: "Tümü" },
];

const VADE_OPTIONS = [
  { id: "tum",     label: "Tüm vadeler" },
  { id: "kritik",  label: "🔴 Kritik (7+ gün geçmiş)" },
  { id: "bekleyen", label: "🟡 Bekleyen (vade öncesi/0-6 gün)" },
  { id: "temiz",   label: "🟢 Temiz" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || "")
    .join("");
}

function vadeBadge(row: BayiRow): { text: string; cls: string } {
  if (!row.isActive) return { text: "Pasif", cls: "bg-slate-100 text-slate-500" };
  if (row.criticalDays === null) return { text: "Temiz", cls: "bg-emerald-50 text-emerald-700" };
  if (row.criticalDays >= 7) return { text: `${row.criticalDays} gün geçmiş`, cls: "bg-rose-50 text-rose-700 font-semibold" };
  if (row.criticalDays >= 0) return { text: "Bekleyen", cls: "bg-amber-50 text-amber-700" };
  return { text: "Vade öncesi", cls: "bg-sky-50 text-sky-700" };
}

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function BayilerPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") || params.get("token") || "";
  const [init, setInit] = useState<InitResp["user"] | null>(null);
  const [error, setError] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);

  // URL params (controlled)
  const page = parseInt(params.get("page") || "1", 10);
  const pageSize = parseInt(params.get("pageSize") || "20", 10);
  const q = params.get("q") || "";
  const status = params.get("status") || "aktif";
  const vade = params.get("vade") || "tum";

  const [searchInput, setSearchInput] = useState(q);

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams({ t: token, page: String(page), pageSize: String(pageSize), status, vade });
    if (q) sp.set("q", q);
    return `/api/bayiler/list?${sp.toString()}`;
  }, [token, page, pageSize, q, status, vade]);

  // Init + tour Task 1 (bayilerim) advance fire-once
  useEffect(() => {
    if (!token) { setError("Geçersiz link — token bulunamadı."); return; }
    fetch(`/api/bayiler/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Init hatası");
        setInit(d.user);
        // Tour koridor — liste sayfası açıldıkça "bayilerim" tamam.
        fetch(`/api/tour/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, event: "tour_bayilerim_done" }),
        }).catch(() => { /* sessiz */ });
      })
      .catch(e => setError(e.message || "Bağlantı hatası"));
  }, [token]);

  // List fetch
  useEffect(() => {
    if (!init) return;
    setLoading(true);
    fetch(apiUrl)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı");
        setData(d);
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [init, apiUrl]);

  // URL'i güncelle
  function pushParams(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    if (token && !sp.has("t")) sp.set("t", token);
    router.push(`?${sp.toString()}`);
  }

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) pushParams({ q: searchInput || null, page: "1" });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700 mb-2">Bağlantı hatası</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!init) {
    return <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-sm text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">📋 Bayilerim</h1>
              {init.ticariUnvan && (
                <p className="text-xs text-slate-500 mt-0.5">{init.ticariUnvan}</p>
              )}
            </div>
            {data && (
              <div className="text-xs text-slate-500">
                {data.total} bayi · sayfa {data.page}/{data.pages}
              </div>
            )}
          </div>

          {/* Arama + filtreler */}
          <div className="flex gap-2 flex-wrap">
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="🔍 İsim, şehir, telefon ara…"
              className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <select
              value={status}
              onChange={e => pushParams({ status: e.target.value, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select
              value={vade}
              onChange={e => pushParams({ vade: e.target.value, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {VADE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading && !data ? (
          <div className="text-center text-sm text-slate-500 py-8">Yükleniyor...</div>
        ) : data && data.rows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Bu filtreyle eşleşen bayi yok.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.rows.map(row => {
              const badge = vadeBadge(row);
              const detailHref = `/tr/bayiler/${row.id}?t=${encodeURIComponent(token)}`;
              return (
                <Link
                  key={row.id}
                  href={detailHref}
                  className="block bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm ${row.isCritical ? "bg-rose-500" : row.isActive ? "bg-indigo-500" : "bg-slate-400"}`}>
                      {initials(row.name)}
                    </div>

                    {/* Bilgi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-slate-900 truncate">{row.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                        {row.city && <span>📍 {row.city}{row.country ? `/${row.country}` : ""}</span>}
                        {row.contactPhone && <span>📞 {row.contactPhone}</span>}
                        {row.contactName && <span>👤 {row.contactName}</span>}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                        <span><strong className={row.balance > 0 ? "text-rose-600" : "text-slate-700"}>{formatTry(row.balance)}</strong> bakiye</span>
                        {row.lastOrderDate && (
                          <span className="text-slate-400">son sipariş {formatDate(row.lastOrderDate)}</span>
                        )}
                      </div>
                    </div>

                    {/* Hızlı aksiyonlar */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {row.contactPhone && (
                        <a
                          href={`https://wa.me/${row.contactPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600"
                          title="WhatsApp mesaj gönder"
                        >
                          📩
                        </a>
                      )}
                      {row.contactPhone && (
                        <a
                          href={`tel:${row.contactPhone}`}
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg hover:bg-sky-50 text-sky-600"
                          title="Ara"
                        >
                          📞
                        </a>
                      )}
                      <span className="p-2 text-slate-400" title="Detay için tıkla">
                        ›
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <select
              value={pageSize}
              onChange={e => pushParams({ pageSize: e.target.value, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / sayfa</option>)}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => pushParams({ page: String(Math.max(1, page - 1)) })}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                ‹ Önceki
              </button>
              <span className="text-sm text-slate-600">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => pushParams({ page: String(Math.min(data.pages, page + 1)) })}
                disabled={page >= data.pages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                Sonraki ›
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
