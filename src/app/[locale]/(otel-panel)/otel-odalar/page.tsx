"use client";

/**
 * /tr/otel-odalar — Oda envanteri grid (banking style).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DoorClosed, Users, BedDouble } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Room {
  id: string;
  name: string;
  room_type: string | null;
  bed_type: string | null;
  max_occupancy: number | null;
  base_price: number | null;
  status: string | null;
  sort_order: number | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  clean:        { label: "Temiz",       cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  dirty:        { label: "Kirli",       cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  out_of_order: { label: "Servis Dışı", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function OtelOdalarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [list, setList] = useState<Room[] | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/list-rooms?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.rooms) setList(d.rooms); })
      .catch(() => setList([]));
  }, [token]);

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Odalar"
        subtitle={
          list === null
            ? "Yüklüyoruz…"
            : `${list.length} oda — temiz/kirli durumu ve gece fiyatı tek bakışta.`
        }
        Icon={DoorClosed}
      />

      {list === null && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height="h-32" />)}
        </div>
      )}

      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <DoorClosed className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Henüz oda tanımlanmamış. Otel kaydınıza bağlı odalar burada görünecek.
          </p>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((r) => {
            const status = STATUS_LABEL[r.status || ""] || { label: r.status || "—", cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            return (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DoorClosed className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${status.cls}`}>{status.label}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{r.name}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                  {r.room_type && <div className="capitalize">{r.room_type}</div>}
                  {r.bed_type && <div className="text-slate-500 inline-flex items-center gap-1"><BedDouble className="w-3 h-3" /> {r.bed_type}</div>}
                  {r.max_occupancy && (
                    <div className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {r.max_occupancy} kişi</div>
                  )}
                </div>
                {r.base_price !== null && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {fmtTRY(Number(r.base_price))}{" "}
                      <span className="text-[10px] text-slate-500 font-normal">/gece</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
