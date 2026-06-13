"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2 } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Entry {
  id: string;
  room_type: string;
  date: string;
  price: number;
  season_label: string | null;
}

interface RoomType {
  room_type: string;
  base_price: number | null;
}

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function OtelFiyatPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [showAdd, setShowAdd] = useState(false);
  const [editCell, setEditCell] = useState<{ room_type: string; date: string; price: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    const qs = token ? `&t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/price-calendar?start=${encodeURIComponent(startDate)}&days=30${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (d?.entries) setEntries(d.entries);
        if (d?.roomTypes) setRoomTypes(d.roomTypes);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [startDate, token]);

  const dates = useMemo(() => {
    const arr: { date: string; day: number; weekday: string }[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      arr.push({
        date: d.toISOString().slice(0, 10),
        day: d.getDate(),
        weekday: d.toLocaleDateString("tr-TR", { weekday: "short" }),
      });
    }
    return arr;
  }, [startDate]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(`${e.room_type}::${e.date}`, e);
    return m;
  }, [entries]);

  const basePriceMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of roomTypes) m.set(r.room_type, r.base_price);
    return m;
  }, [roomTypes]);

  const shiftDays = (delta: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + delta);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);

  const savePrice = async (room_type: string, date: string, price: number, season_label?: string) => {
    setError(null);
    const body: any = { room_type, date, price, season_label };
    if (token) body.token = token;
    const r = await fetch("/api/otel-panel/price-calendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d?.error) { setError(d.error); return false; }
    reload();
    return true;
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Bu override silinsin mi? (oda base_price'ına dönülecek)")) return;
    setError(null);
    const qs = token ? `&t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/otel-panel/price-calendar?id=${id}${qs}`, { method: "DELETE", credentials: "same-origin" });
    const d = await r.json();
    if (d?.error) setError(d.error);
    else reload();
  };

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Fiyat Takvimi"
        subtitle="Oda tipi × gün bazlı sezon fiyatları. Boş hücreler oda kartındaki temel fiyatı kullanır. Tıklayarak override edebilirsiniz."
        Icon={TrendingUp}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDays(-7)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setStartDate(new Date().toISOString().slice(0, 10))} className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">Bugün</button>
          <button onClick={() => shiftDays(7)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
          <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {new Date(startDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}'dan 30 gün
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Sezon Ekle
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton height="h-12" />
          <Skeleton height="h-12" />
          <Skeleton height="h-12" />
        </div>
      ) : roomTypes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400">Önce oda ekleyin, sonra burada fiyat tanımlayabilirsiniz.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">Oda Tipi</th>
                {dates.map(d => {
                  const isToday = d.date === today;
                  const isWeekend = d.weekday === "Cmt" || d.weekday === "Paz";
                  return (
                    <th key={d.date} className={`px-1 py-1 text-center font-medium min-w-[56px] ${
                      isToday ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" :
                      isWeekend ? "bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400" :
                      "text-slate-600 dark:text-slate-400"
                    }`}>
                      <div className="text-[10px] uppercase">{d.weekday}</div>
                      <div className="text-sm font-bold">{d.day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map(rt => (
                <tr key={rt.room_type} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200">
                    <div className="font-semibold text-sm capitalize">{rt.room_type}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Temel: {rt.base_price != null ? fmtTRY(Number(rt.base_price)) : "—"}
                    </div>
                  </td>
                  {dates.map(d => {
                    const entry = cellMap.get(`${rt.room_type}::${d.date}`);
                    const basePrice = basePriceMap.get(rt.room_type);
                    return (
                      <td key={d.date} className="px-0.5 py-2">
                        <button
                          onClick={() => setEditCell({
                            room_type: rt.room_type, date: d.date,
                            price: entry ? Number(entry.price) : (basePrice ? Number(basePrice) : 0),
                          })}
                          className={`w-full h-9 rounded text-[11px] font-medium px-1 ${
                            entry ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                                  : "bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300"
                          }`}
                          title={entry ? `${entry.season_label || "Özel fiyat"}` : "Temel fiyat"}
                        >
                          {entry ? Math.round(Number(entry.price)) : "·"}
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

      {entries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Aktif Fiyat Override'ları</h3>
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium capitalize">{e.room_type}</span> · {e.date} · <span className="font-semibold">{fmtTRY(Number(e.price))}</span>
                  {e.season_label && <span className="ml-2 text-xs text-slate-500">[{e.season_label}]</span>}
                </div>
                <button onClick={() => deleteEntry(e.id)} className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editCell && (
        <EditCellModal cell={editCell} onClose={() => setEditCell(null)}
          onSave={async (price, season_label) => {
            const ok = await savePrice(editCell.room_type, editCell.date, price, season_label);
            if (ok) setEditCell(null);
          }}
        />
      )}
      {showAdd && (
        <SeasonModal roomTypes={roomTypes} onClose={() => setShowAdd(false)}
          onSave={async (rt, start, end, price, label) => {
            setShowAdd(false);
            const startD = new Date(start);
            const endD = new Date(end);
            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
              await savePrice(rt, d.toISOString().slice(0, 10), price, label);
            }
          }}
        />
      )}
    </div>
  );
}

function EditCellModal({ cell, onClose, onSave }: {
  cell: { room_type: string; date: string; price: number };
  onClose: () => void;
  onSave: (price: number, season_label?: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(cell.price));
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave(Number(price), label || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 capitalize">{cell.room_type} · {cell.date}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Fiyat (₺) *</span>
          <input type="number" min={0} step={50} required value={price} onChange={e => setPrice(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sezon etiketi (opsiyonel)</span>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Yüksek Sezon, Bayram, Hafta sonu" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

function SeasonModal({ roomTypes, onClose, onSave }: {
  roomTypes: RoomType[];
  onClose: () => void;
  onSave: (room_type: string, start: string, end: string, price: number, label: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [rt, setRt] = useState(roomTypes[0]?.room_type || "");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!rt && roomTypes.length > 0) setRt(roomTypes[0].room_type); }, [roomTypes, rt]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rt || !price) return;
    setSubmitting(true);
    try {
      await onSave(rt, start, end, Number(price), label);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sezon Fiyatı Tanımla</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Tarih aralığındaki tüm günler için tek fiyat yazılır.</p>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Oda tipi *</span>
          <select required value={rt} onChange={e => setRt(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {roomTypes.map(r => <option key={r.room_type} value={r.room_type}>{r.room_type}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Başlangıç *</span>
            <input type="date" required value={start} onChange={e => setStart(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Bitiş *</span>
            <input type="date" required value={end} onChange={e => setEnd(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Fiyat (₺) *</span>
          <input type="number" required min={0} step={50} value={price} onChange={e => setPrice(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="2500" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sezon etiketi</span>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Yüksek Sezon" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting || roomTypes.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Uygula
          </button>
        </div>
      </form>
    </div>
  );
}
