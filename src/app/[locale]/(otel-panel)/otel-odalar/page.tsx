"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  clean:        { label: "Temiz",         color: "bg-emerald-100 text-emerald-800" },
  dirty:        { label: "Kirli",         color: "bg-amber-100 text-amber-800" },
  out_of_order: { label: "Servis Dışı",   color: "bg-rose-100 text-rose-700" },
};

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Odalar</h1>
        <span className="text-xs text-slate-500">{list?.length ?? "—"} oda</span>
      </div>

      {list === null && <div className="text-sm text-slate-500">⏳ Yükleniyor...</div>}
      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center text-sm text-slate-600 shadow-sm">
          Henüz oda tanımlanmamış. Otel kaydınıza bağlı odalar burada görünecek.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((r) => {
            const status = STATUS_LABEL[r.status || ""] || { label: r.status || "—", color: "bg-slate-100 text-slate-700" };
            return (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-lg font-bold text-slate-900">🚪 {r.name}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
                </div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  {r.room_type && <div className="capitalize">{r.room_type}</div>}
                  {r.bed_type && <div className="text-slate-500">{r.bed_type}</div>}
                  {r.max_occupancy && <div>👥 {r.max_occupancy} kişi</div>}
                  {r.base_price !== null && <div className="font-semibold text-slate-900 mt-1">{Number(r.base_price).toLocaleString("tr-TR")} ₺ <span className="text-[10px] text-slate-500">/gece</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
