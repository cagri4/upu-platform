"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

type Room = {
  id: string;
  name: string;
  room_type: string;
  status: string;
  base_price: number | null;
};

type Reservation = {
  id: string;
  room_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number | null;
};

type DayInfo = { date: string; day: number; weekday: string };

const STATUS_COLOR: Record<string, string> = {
  pending:      "bg-amber-300 dark:bg-amber-700/70 text-amber-900 dark:text-amber-100",
  confirmed:    "bg-blue-300 dark:bg-blue-700/70 text-blue-900 dark:text-blue-100",
  checked_in:   "bg-emerald-400 dark:bg-emerald-700/70 text-emerald-900 dark:text-emerald-100",
  checked_out:  "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylı",
  checked_in: "Konaklamada",
  checked_out: "Çıkış yaptı",
};

export default function OtelTakvimPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dates, setDates] = useState<DayInfo[]>([]);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedRez, setSelectedRez] = useState<Reservation | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `/api/otel-panel/calendar?start=${encodeURIComponent(startDate)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
        const r = await fetch(url, { credentials: "same-origin" });
        const d = await r.json();
        if (cancelled) return;
        setRooms(d.rooms || []);
        setReservations(d.reservations || []);
        setDates(d.dates || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startDate, token]);

  const cellMap = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of reservations) {
      const start = new Date(r.check_in);
      const end = new Date(r.check_out);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const key = `${r.room_id}::${d.toISOString().slice(0, 10)}`;
        map.set(key, r);
      }
    }
    return map;
  }, [reservations]);

  const shiftDays = (delta: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + delta);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date(startDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Müsaitlik Takvimi"
        subtitle="Tüm odaların 30 günlük doluluk grid'i. Renkli hücreler rezervasyonu, boş hücreler müsaitliği gösterir."
        Icon={CalendarDays}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDays(-7)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            aria-label="Önceki 7 gün"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStartDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
          >
            Bugün
          </button>
          <button
            onClick={() => shiftDays(7)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            aria-label="Sonraki 7 gün"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">{todayLabel} →</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <span key={k} className={`px-2 py-0.5 rounded-md font-medium ${STATUS_COLOR[k]}`}>{v}</span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton height="h-12" />
          <Skeleton height="h-12" />
          <Skeleton height="h-12" />
          <Skeleton height="h-12" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400">Henüz oda tanımlı değil. Oda menüsünden ekleyin.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">Oda</th>
                {dates.map((d) => {
                  const isToday = d.date === today;
                  const isWeekend = d.weekday === "Cmt" || d.weekday === "Paz";
                  return (
                    <th
                      key={d.date}
                      className={`px-1 py-1 text-center font-medium min-w-[36px] ${
                        isToday ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" :
                        isWeekend ? "bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400" :
                        "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="text-[10px] uppercase">{d.weekday}</div>
                      <div className="text-sm font-bold">{d.day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200">
                    <div className="font-semibold text-sm">{room.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{room.room_type}</div>
                  </td>
                  {dates.map((d) => {
                    const rez = cellMap.get(`${room.id}::${d.date}`);
                    if (!rez) {
                      return (
                        <td key={d.date} className="px-1 py-2">
                          <div className="h-7 rounded bg-slate-50 dark:bg-slate-800/40" />
                        </td>
                      );
                    }
                    const isStart = d.date === rez.check_in;
                    return (
                      <td key={d.date} className="px-0.5 py-2">
                        <button
                          onClick={() => setSelectedRez(rez)}
                          className={`w-full h-7 rounded ${STATUS_COLOR[rez.status] || "bg-slate-200 dark:bg-slate-700"} text-[10px] font-medium overflow-hidden whitespace-nowrap text-ellipsis px-1`}
                          title={`${rez.guest_name} · ${rez.check_in} → ${rez.check_out}`}
                        >
                          {isStart ? rez.guest_name.split(" ")[0] : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRez && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedRez(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{selectedRez.guest_name}</h3>
              <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${STATUS_COLOR[selectedRez.status]}`}>
                {STATUS_LABEL[selectedRez.status] || selectedRez.status}
              </span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <p><span className="font-medium">Giriş:</span> {selectedRez.check_in}</p>
              <p><span className="font-medium">Çıkış:</span> {selectedRez.check_out}</p>
              {selectedRez.total_price ? (
                <p><span className="font-medium">Toplam:</span> {selectedRez.total_price.toLocaleString("tr-TR")} ₺</p>
              ) : null}
            </div>
            <button
              onClick={() => setSelectedRez(null)}
              className="w-full mt-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
