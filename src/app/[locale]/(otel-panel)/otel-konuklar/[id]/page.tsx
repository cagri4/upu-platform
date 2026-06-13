"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Phone, Calendar, DoorClosed, Repeat, DollarSign, ArrowLeft, Mail } from "lucide-react";
import { HeroBanner, StatCard, Skeleton } from "@/components/banking";

interface Guest {
  id: string;
  display_name: string | null;
  whatsapp_phone: string | null;
  metadata: any;
  created_at: string;
}

interface Stats {
  total_stays: number;
  total_spend: number;
  lifetime_records: number;
}

interface Rez {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number | null;
  source: string | null;
  otel_rooms: { name?: string; room_type?: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmed:   { label: "Onaylı",      cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  checked_in:  { label: "Konaklamada", cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  checked_out: { label: "Çıktı",       cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
  pending:     { label: "Beklemede",   cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  cancelled:   { label: "İptal",       cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

function fmtTRY(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MisafirDetayPage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const id = params.id;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Rez[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/guest/${id}${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(d.error); return; }
        setGuest(d.guest);
        setStats(d.stats);
        setReservations(d.reservations || []);
      })
      .catch(e => setError(e?.message || "Hata"));
  }, [id, token]);

  const backLink = `/tr/otel-konuklar${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href={backLink} className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400">
          <ArrowLeft className="w-3 h-3" /> Misafirler
        </Link>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      ) : !guest ? (
        <div className="space-y-3">
          <Skeleton height="h-32" />
          <Skeleton height="h-20" />
          <Skeleton height="h-40" />
        </div>
      ) : (
        <>
          <HeroBanner
            title={guest.display_name || "Misafir"}
            subtitle={`UPU Otel'e ${fmtDate(guest.created_at)} tarihinde katıldı`}
            Icon={User}
          />

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {guest.whatsapp_phone && (
                <div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-emerald-600" /> {guest.whatsapp_phone}
                </div>
              )}
              {guest.metadata?.email && (
                <div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-emerald-600" /> {guest.metadata.email}
                </div>
              )}
              {guest.metadata?.tc_no && (
                <div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <User className="w-4 h-4 text-emerald-600" /> TC: {guest.metadata.tc_no}
                </div>
              )}
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Toplam Konaklama" value={String(stats.total_stays)} Icon={Repeat} />
              <StatCard label="Toplam Harcama" value={fmtTRY(stats.total_spend)} Icon={DollarSign} />
              <StatCard label="Rezervasyon Sayısı" value={String(reservations.length)} Icon={Calendar} />
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Konaklama Geçmişi</h3>
            {reservations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Bu misafire ait rezervasyon yok.</p>
            ) : (
              <div className="space-y-2">
                {reservations.map(r => {
                  const status = STATUS_LABEL[r.status] || { label: r.status, cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
                  const room = r.otel_rooms?.name || "—";
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${status.cls}`}>{status.label}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                          <span className="inline-flex items-center gap-1"><DoorClosed className="w-3 h-3" /> {room}</span>
                          {r.source && <span>via {r.source}</span>}
                        </div>
                      </div>
                      {r.total_price != null && (
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0 ml-3">
                          {fmtTRY(Number(r.total_price))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
