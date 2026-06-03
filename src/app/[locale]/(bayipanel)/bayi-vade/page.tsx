"use client";

/**
 * /tr/bayi-vade — Vade Takvimi (renkli grid).
 *
 * Aktif faturalar (open|overdue) due_date ASC. Renk kuralı:
 *   - due_date < today → "GECİKMİŞ" kırmızı badge
 *   - today ≤ due_date < today+7 → "YAKIN" sarı
 *   - due_date ≥ today+7 → "GÜVENLİ" yeşil
 *
 * Bayi: kendi faturaları. Admin/muhasebe: tüm tenant.
 */

import { useEffect, useState } from "react";
import { Calendar, Download } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";
import { EmptyState } from "@/components/ui/EmptyState";
import { kurucuSecondary } from "@/components/empty-state-kurucu-link";

interface InvoiceRow {
  id: string;
  invoice_no: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: string;
  effective_status: string;
  days_to_due: number;
  dealer_name: string | null;
  pdf_url: string | null;
}

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

function badge(r: InvoiceRow): { label: string; cls: string } {
  if (r.effective_status === "paid") return { label: "Ödendi", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700" };
  if (r.effective_status === "cancelled") return { label: "İptal", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600" };
  if (r.days_to_due < 0) return { label: `${Math.abs(r.days_to_due)} gün geçti`, cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 font-semibold" };
  if (r.days_to_due < 7) return { label: `${r.days_to_due} gün kaldı`, cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 font-semibold" };
  return { label: `${r.days_to_due} gün`, cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700" };
}

export default function BayiVadePage() {
  const [me, setMe] = useState<{ role: string | null } | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bayi-panel/me", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.success) setMe({ role: d.role }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!me) return;
    const isAdmin = ["admin", "muhasebe"].includes(me.role || "");
    const scope = isAdmin ? "tenant" : "mine";
    setLoading(true);
    fetch(`/api/bayi-invoices/list?scope=${scope}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        // Sadece aktif (open/overdue) faturaları göster
        const active = (d.rows || []).filter((it: InvoiceRow) =>
          it.effective_status === "open" || it.effective_status === "overdue",
        );
        setRows(active);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [me]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={Calendar} title="Vade Takvimi" subtitle="Yaklaşan ve geçmiş vade ödemelerini renkli grid'de görün." />

      <div className="flex justify-end">
        <a
          href="/api/bayi-export/invoices"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          <Download className="w-3.5 h-3.5" /> Excel
        </a>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <EmptyState
            icon={Calendar}
            title="Bekleyen fatura yok"
            description="Vadesi yaklaşan veya geçmiş açık fatura olmadığında burada görünecek. Kapatılan faturalar 'Faturalar' sekmesinde."
            cta={{ label: "Faturalara Git →", href: "/tr/bayi-faturalarim" }}
            secondary={kurucuSecondary("empty-state:bayi-vade")}
            accent="emerald"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const b = badge(r);
            return (
              <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.invoice_no}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {r.dealer_name && <span>{r.dealer_name} · </span>}
                    Vade: {fmtDate(r.due_date)} · Düzenleme: {fmtDate(r.issue_date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtTRY(r.amount)}</div>
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noopener" className="text-[11px] text-indigo-600 hover:underline">📄 PDF</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
