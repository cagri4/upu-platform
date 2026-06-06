"use client";

/**
 * /tr/bayi-cari — Cari ekstre.
 *
 * Bayi: kendi ekstresi (otomatik).
 * Admin/muhasebe: bayi dropdown + tarih aralığı + ekstre tablosu.
 *
 * Excel export butonu sağ üstte — /api/bayi-export/cari?dealer_id=&from=&to=.
 */

import { useEffect, useState, useCallback } from "react";
import { Wallet, Download } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";
import { EmptyState } from "@/components/ui/EmptyState";

interface StatementRow {
  entry_type: string;
  reference_id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementResp {
  ok: true;
  dealer_id: string;
  rows: StatementRow[];
  opening_balance: number;
  closing_balance: number;
  debit_total: number;
  credit_total: number;
}

interface Dealer {
  id: string;
  name: string;
}

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function BayiCariPage() {
  const [me, setMe] = useState<{ role: string | null } | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<StatementResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bayi-panel/me", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.success) setMe({ role: d.role }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!me) return;
    if (!["admin", "muhasebe"].includes(me.role || "")) return;
    fetch("/api/bayiler/list?pageSize=200", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        setDealers((d.rows || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      })
      .catch(() => {});
  }, [me]);

  const fetchStatement = useCallback(() => {
    if (!me) return;
    const isAdmin = ["admin", "muhasebe"].includes(me.role || "");
    if (isAdmin && !dealerId) return;

    setLoading(true);
    const sp = new URLSearchParams();
    if (isAdmin && dealerId) sp.set("dealer_id", dealerId);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    fetch(`/api/bayi-cari/statement?${sp.toString()}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Ekstre alınamadı.");
        setData(d as StatementResp);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [me, dealerId, from, to]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  const isAdmin = me && ["admin", "muhasebe"].includes(me.role || "");
  const exportUrl = (() => {
    const sp = new URLSearchParams();
    if (isAdmin && dealerId) sp.set("dealer_id", dealerId);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return `/api/bayi-export/cari${sp.toString() ? `?${sp.toString()}` : ""}`;
  })();

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={Wallet} title="Cari Ekstre" subtitle="Hesap hareketlerinizi ve bakiyenizi takip edin." />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {isAdmin && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bayi</label>
              <select value={dealerId} onChange={(e) => setDealerId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800">
                <option value="">— Seçin —</option>
                {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Başlangıç</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bitiş</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
        </div>
        <div className="flex justify-end">
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-12" />)}</div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
          {isAdmin ? "Ekstre görmek için bayi seçin." : "Veriler yükleniyor…"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Açılış" value={fmtTRY(data.opening_balance)} cls="text-slate-700 dark:text-slate-300" />
            <Stat label="Borç" value={fmtTRY(data.debit_total)} cls="text-rose-600" />
            <Stat label="Alacak" value={fmtTRY(data.credit_total)} cls="text-emerald-600" />
            <Stat label="Bakiye" value={fmtTRY(data.closing_balance)} cls={data.closing_balance > 0 ? "text-rose-600" : "text-emerald-600"} />
          </div>

          {data.rows.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pb-4">
              <EmptyState
                icon={Wallet}
                title="Cari ekstre boş"
                description="Bayilerin sipariş + ödeme yaptıkça hareketler burada birikir."
                cta={{ label: "Bayi davet et", href: "/tr/bayi-davet-et" }}
                accent="indigo"
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Tarih</th>
                    <th className="px-3 py-2 text-left">Açıklama</th>
                    <th className="px-3 py-2 text-right">Borç</th>
                    <th className="px-3 py-2 text-right">Alacak</th>
                    <th className="px-3 py-2 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`${r.entry_type}-${r.reference_id}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-xs">{fmtDate(r.entry_date)}</td>
                      <td className="px-3 py-2 text-xs">{r.description}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{r.debit ? fmtTRY(r.debit) : "—"}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{r.credit ? fmtTRY(r.credit) : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtTRY(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-bold ${cls}`}>{value}</p>
    </div>
  );
}
