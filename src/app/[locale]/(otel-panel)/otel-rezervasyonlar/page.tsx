"use client";

/**
 * /tr/otel-rezervasyonlar — Rezervasyon listesi (banking style).
 *
 * Pattern: bayi-faturalarim/page.tsx ile aynı görsel dil — HeroBanner +
 * Skeleton + filter chips + banking-style row card.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BedDouble, Phone, DoorClosed, Calendar, ClipboardCheck } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Reservation {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  status: string | null;
  total_price: number | null;
  source: string | null;
  pre_checkin_complete: boolean | null;
  otel_rooms: { name?: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmed:    { label: "Onaylı",       cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  checked_in:   { label: "Konaklamada",  cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  checked_out:  { label: "Çıktı",        cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
  pending:      { label: "Beklemede",    cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  cancelled:    { label: "İptal",        cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}
function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function OtelRezervasyonlarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [list, setList] = useState<Reservation[] | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "today" | "upcoming">("all");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/list-reservations?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.reservations) setList(d.reservations); })
      .catch(() => setList([]));
  }, [token]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = (list ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return r.status === "checked_in";
    if (filter === "today") return r.check_in === today;
    if (filter === "upcoming") return r.check_in > today && r.status !== "cancelled";
    return true;
  });

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Rezervasyonlar"
        subtitle={
          list === null
            ? "Yüklüyoruz…"
            : `${list.length} kayıt — bugünkü çek-in/çek-out ve gelecek konaklamalar tek listede.`
        }
        Icon={BedDouble}
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: "Tümü" },
          { key: "active", label: "Konaklamada" },
          { key: "today", label: "Bugün Çek-in" },
          { key: "upcoming", label: "Yaklaşan" },
        ] as const).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f.key
                ? "bg-emerald-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
        </div>
      )}

      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <BedDouble className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Henüz rezervasyon yok. WhatsApp&apos;ta <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">rezervasyonekle</span> komutuyla ekleyebilirsiniz.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => {
            const status = STATUS_LABEL[r.status || ""] || { label: r.status || "—", cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            const room = r.otel_rooms?.name || "—";
            return (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{r.guest_name || "—"}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${status.cls}`}>{status.label}</span>
                      {r.pre_checkin_complete && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" title="Online çek-in tamam">
                          <ClipboardCheck className="w-3 h-3" /> Çek-in tamam
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(r.check_in)} → {fmtDate(r.check_out)}</span>
                      <span className="inline-flex items-center gap-1"><DoorClosed className="w-3 h-3" /> Oda {room}</span>
                      {r.guest_phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {r.guest_phone}</span>
                      )}
                      {r.source && <span className="text-slate-400">via {r.source}</span>}
                    </div>
                  </div>
                  {r.total_price !== null && (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtTRY(Number(r.total_price))}</div>
                    </div>
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
