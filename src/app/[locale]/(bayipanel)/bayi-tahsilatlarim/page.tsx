"use client";

/**
 * Tahsilatlarım — bayi vade/tahsilat dashboard.
 *
 * URL: /tr/bayi-tahsilatlarim?t=<token>
 *
 * Üst kart: 3 metrik (vadesi geçmiş, bekleyen, bu ay tahsilat).
 * Liste: vadesi geçmiş + bekleyen faturalar (top 50).
 * Üst aksiyon: "+ Tahsilat Hatırlatma" → /tr/bayi-vade-hatirlatma.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Invoice {
  id: string;
  invoice_no: string;
  amount: number;
  is_paid: boolean;
  due_date: string;
  created_at: string;
  dealer_name: string | null;
}

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

function daysFromNow(iso: string): number {
  const d = new Date(iso);
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

export default function TahsilatlarimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/bayi-fatura/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı");
        setInvoices(d.invoices || []);
        setError("");
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token]);

  const unpaid = invoices.filter(i => !i.is_paid);
  const overdue = unpaid.filter(i => daysFromNow(i.due_date) < 0);
  const pending = unpaid.filter(i => daysFromNow(i.due_date) >= 0);
  const overdueAmount = overdue.reduce((s, i) => s + (i.amount || 0), 0);
  const pendingAmount = pending.reduce((s, i) => s + (i.amount || 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthPaid = invoices.filter(i => i.is_paid && new Date(i.created_at) >= monthStart);
  const monthAmount = monthPaid.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-slate-900">💰 Tahsilatlarım</h1>
          <a
            href={`/tr/bayi-vade-hatirlatma?t=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
          >
            <span>+</span> Tahsilat Hatırlatma
          </a>
        </div>
      </div>

      {/* 3 KPI metrikleri */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-xl p-4 shadow-sm">
          <div className="text-xs opacity-90">Vadesi Geçmiş</div>
          <div className="text-2xl font-bold mt-1">{formatTry(overdueAmount)}</div>
          <div className="text-xs opacity-80 mt-0.5">{overdue.length} fatura</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl p-4 shadow-sm">
          <div className="text-xs opacity-90">Bekleyen</div>
          <div className="text-2xl font-bold mt-1">{formatTry(pendingAmount)}</div>
          <div className="text-xs opacity-80 mt-0.5">{pending.length} fatura</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-4 shadow-sm">
          <div className="text-xs opacity-90">Bu Ay Tahsilat</div>
          <div className="text-2xl font-bold mt-1">{formatTry(monthAmount)}</div>
          <div className="text-xs opacity-80 mt-0.5">{monthPaid.length} fatura</div>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="text-center text-sm text-slate-500 py-8">Yükleniyor…</div>
      ) : unpaid.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Şu an ödenmemiş faturanız yok. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 mt-2">Ödenmemiş Faturalar</h2>
          {unpaid.slice(0, 50).map(inv => {
            const days = daysFromNow(inv.due_date);
            const isOverdue = days < 0;
            return (
              <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{inv.invoice_no || "—"}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        isOverdue ? "bg-rose-50 text-rose-700 font-semibold" : "bg-amber-50 text-amber-700"
                      }`}>
                        {isOverdue ? `${Math.abs(days)} gün geçmiş` : `${days} gün kaldı`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {inv.dealer_name || "—"} · vade {formatDate(inv.due_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatTry(inv.amount)}</div>
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
