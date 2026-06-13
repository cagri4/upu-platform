"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BedDouble, Phone, DoorClosed, Calendar, ClipboardCheck, Plus, LogIn, LogOut, X, Loader2 } from "lucide-react";
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

interface Room {
  id: string;
  name: string;
  room_type: string;
  base_price: number | null;
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-reservations${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.reservations) setList(d.reservations); })
      .catch(() => setList([]));
  };

  useEffect(() => {
    reload();
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-rooms${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { if (d?.rooms) setRooms(d.rooms); })
      .catch(() => {});
  }, [token]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = (list ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return r.status === "checked_in";
    if (filter === "today") return r.check_in === today;
    if (filter === "upcoming") return r.check_in > today && r.status !== "cancelled";
    return true;
  });

  const doAction = async (rezId: string, action: "check_in" | "check_out" | "cancel" | "confirm") => {
    setActionId(rezId);
    setError(null);
    try {
      const body: any = { action };
      if (token) body.token = token;
      const r = await fetch(`/api/otel-panel/reservations/${rezId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reload();
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setActionId(null);
    }
  };

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

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Yeni Rezervasyon
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {list === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
        </div>
      )}

      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <BedDouble className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Henüz rezervasyon yok. Yukarıdaki <strong>Yeni Rezervasyon</strong> ile ekleyin veya WhatsApp&apos;ta <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">rezervasyonekle</span> yazın.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => {
            const status = STATUS_LABEL[r.status || ""] || { label: r.status || "—", cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            const room = r.otel_rooms?.name || "—";
            const isToday = r.check_in === today;
            const canCheckIn = (r.status === "confirmed" || r.status === "pending") && r.check_in <= today;
            const canCheckOut = r.status === "checked_in";
            const canCancel = r.status !== "cancelled" && r.status !== "checked_out";
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
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {r.total_price !== null && (
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtTRY(Number(r.total_price))}</div>
                    )}
                    <div className="flex gap-1">
                      {canCheckIn && (
                        <button
                          onClick={() => doAction(r.id, "check_in")}
                          disabled={actionId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 disabled:opacity-50"
                          title="Check-in et"
                        >
                          {actionId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                          Çek-in
                        </button>
                      )}
                      {canCheckOut && (
                        <button
                          onClick={() => doAction(r.id, "check_out")}
                          disabled={actionId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                          title="Check-out et"
                        >
                          {actionId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                          Çek-out
                        </button>
                      )}
                      {canCancel && !canCheckIn && !canCheckOut && (
                        <button
                          onClick={() => { if (confirm("Rezervasyon iptal edilsin mi?")) doAction(r.id, "cancel"); }}
                          disabled={actionId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-medium hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50"
                          title="İptal et"
                        >
                          {actionId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          İptal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddReservationModal
          token={token}
          rooms={rooms}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); reload(); }}
        />
      )}
    </div>
  );
}

function AddReservationModal({ token, rooms, onClose, onCreated }: {
  token: string | null;
  rooms: Room[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!roomId && rooms.length > 0) setRoomId(rooms[0].id); }, [rooms, roomId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = {
        room_id: roomId,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || undefined,
        check_in: checkIn,
        check_out: checkOut,
        status: "confirmed",
        source: "manual",
      };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onCreated();
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
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Yeni Rezervasyon</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Misafir adı *</span>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ahmet Yılmaz"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Telefon</span>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="+90 555 555 5555"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Oda *</span>
            <select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {rooms.length === 0 && <option value="">Önce oda ekleyin</option>}
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.room_type}{r.base_price ? ` (${r.base_price} ₺)` : ""}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Giriş *</span>
              <input
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Çıkış *</span>
              <input
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={submitting || rooms.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Oluştur
          </button>
        </div>
      </form>
    </div>
  );
}
