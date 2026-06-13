"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DoorClosed, Users, BedDouble, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react";
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
  inspected:    { label: "Kontrol OK",  cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  occupied:     { label: "Dolu",        cls: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
  out_of_order: { label: "Servis Dışı", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function OtelOdalarPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [list, setList] = useState<Room[] | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-rooms${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.rooms) setList(d.rooms); })
      .catch(() => setList([]));
  };

  useEffect(() => { reload(); }, [token]);

  const handleDelete = async (room: Room) => {
    if (!confirm(`"${room.name}" silinsin mi?`)) return;
    setError(null);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/otel-panel/rooms/${room.id}${qs}`, { method: "DELETE", credentials: "same-origin" });
    const d = await r.json();
    if (d?.error) setError(d.error);
    else reload();
  };

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

      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Yeni Oda
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {list === null && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height="h-32" />)}
        </div>
      )}

      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <DoorClosed className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Henüz oda tanımlanmamış. Yukarıdaki <strong>Yeni Oda</strong> ile ekleyin.
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition relative group"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <button
                    onClick={() => setEditingRoom(r)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                    title="Düzenle"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400"
                    title="Sil"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
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

      {showAddModal && (
        <RoomModal
          token={token}
          room={null}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); reload(); }}
        />
      )}
      {editingRoom && (
        <RoomModal
          token={token}
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onSaved={() => { setEditingRoom(null); reload(); }}
        />
      )}
    </div>
  );
}

function RoomModal({ token, room, onClose, onSaved }: {
  token: string | null;
  room: Room | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(room?.name || "");
  const [roomType, setRoomType] = useState(room?.room_type || "standart");
  const [bedType, setBedType] = useState(room?.bed_type || "");
  const [maxOccupancy, setMaxOccupancy] = useState<number>(room?.max_occupancy || 2);
  const [basePrice, setBasePrice] = useState<string>(room?.base_price != null ? String(room.base_price) : "");
  const [status, setStatus] = useState(room?.status || "clean");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = {
        name: name.trim(),
        room_type: roomType.trim(),
        bed_type: bedType.trim() || undefined,
        max_occupancy: maxOccupancy,
        base_price: basePrice ? Number(basePrice) : undefined,
        status,
      };
      if (token) body.token = token;
      const url = room ? `/api/otel-panel/rooms/${room.id}` : `/api/otel-panel/rooms`;
      const r = await fetch(url, {
        method: room ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onSaved();
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {room ? "Oda Düzenle" : "Yeni Oda"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Oda adı / no *</span>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="101 veya Deniz Manzaralı"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Oda tipi *</span>
              <input
                type="text" required value={roomType} onChange={(e) => setRoomType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="standart, suit, aile"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Yatak</span>
              <input
                type="text" value={bedType} onChange={(e) => setBedType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="çift, tek, ikiz"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Maks. kişi</span>
              <input
                type="number" min={1} max={20} value={maxOccupancy}
                onChange={(e) => setMaxOccupancy(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Gecelik (₺)</span>
              <input
                type="number" min={0} step={50} value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="1500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Durum</span>
            <select
              value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="clean">Temiz</option>
              <option value="dirty">Kirli</option>
              <option value="inspected">Kontrol OK</option>
              <option value="occupied">Dolu</option>
              <option value="out_of_order">Servis Dışı</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            İptal
          </button>
          <button
            type="submit" disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {room ? "Kaydet" : "Oluştur"}
          </button>
        </div>
      </form>
    </div>
  );
}
