"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Plus, X, Loader2, Play, Check, RotateCcw, DoorClosed, Calendar } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Task {
  id: string;
  room_id: string | null;
  task_type: string;
  priority: number | null;
  status: string;
  queue_date: string;
  notes: string | null;
  assigned_to: string | null;
  otel_rooms: { name?: string; room_type?: string } | null;
}

interface Room {
  id: string;
  name: string;
  room_type: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Bekliyor",     cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  in_progress: { label: "Devam ediyor", cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  completed:   { label: "Tamamlandı",   cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
};

const TASK_TYPE_LABEL: Record<string, string> = {
  check_out_clean: "Çıkış Sonrası Temizlik",
  daily_clean: "Günlük Temizlik",
  deep_clean: "Detaylı Temizlik",
  maintenance: "Bakım",
  inspection: "Kontrol",
};

export default function OtelHousekeepingPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("pending");
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/housekeeping${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { if (d?.tasks) setTasks(d.tasks); else setTasks([]); })
      .catch(() => setTasks([]));
  };

  useEffect(() => {
    reload();
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-rooms${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => { if (d?.rooms) setRooms(d.rooms); })
      .catch(() => {});
  }, [token]);

  const doAction = async (taskId: string, action: "start" | "complete" | "reopen") => {
    setActionId(taskId);
    setError(null);
    try {
      const body: any = { action };
      if (token) body.token = token;
      const r = await fetch(`/api/otel-panel/housekeeping/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reload();
    } finally {
      setActionId(null);
    }
  };

  const filtered = (tasks ?? []).filter(t => filter === "all" ? true : t.status === filter);

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Kat Hizmetleri"
        subtitle="Bugünkü ve bekleyen temizlik/bakım görevleri. Çıkış yapan misafirler için otomatik görev oluşturulur."
        Icon={Sparkles}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "pending", label: "Bekleyen" },
            { key: "in_progress", label: "Devam Eden" },
            { key: "completed", label: "Tamamlanan" },
            { key: "all", label: "Tümü" },
          ] as const).map((f) => (
            <button
              key={f.key}
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
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Yeni Görev
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {tasks === null && (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      )}

      {tasks?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <Sparkles className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">Şu an temizlik görevi yok.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(t => {
            const meta = STATUS_META[t.status] || { label: t.status, cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            const room = t.otel_rooms?.name || "—";
            const taskLabel = TASK_TYPE_LABEL[t.task_type] || t.task_type;
            return (
              <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{taskLabel}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                      {t.priority === 1 && <span className="text-[11px] px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">Acil</span>}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><DoorClosed className="w-3 h-3" /> {room}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.queue_date}</span>
                    </div>
                    {t.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{t.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {t.status === "pending" && (
                      <button
                        onClick={() => doAction(t.id, "start")}
                        disabled={actionId === t.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 disabled:opacity-50"
                      >
                        {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Başla
                      </button>
                    )}
                    {t.status === "in_progress" && (
                      <button
                        onClick={() => doAction(t.id, "complete")}
                        disabled={actionId === t.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50"
                      >
                        {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Tamamla
                      </button>
                    )}
                    {t.status === "completed" && (
                      <button
                        onClick={() => doAction(t.id, "reopen")}
                        disabled={actionId === t.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        {actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Yeniden Aç
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddTaskModal token={token} rooms={rooms} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); reload(); }} />}
    </div>
  );
}

function AddTaskModal({ token, rooms, onClose, onCreated }: {
  token: string | null;
  rooms: Room[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [taskType, setTaskType] = useState("daily_clean");
  const [priority, setPriority] = useState<number>(2);
  const [queueDate, setQueueDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!roomId && rooms.length > 0) setRoomId(rooms[0].id); }, [rooms, roomId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { room_id: roomId, task_type: taskType, priority, queue_date: queueDate, notes: notes || undefined };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/housekeeping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Yeni Temizlik Görevi</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Oda *</span>
            <select required value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {rooms.length === 0 && <option value="">Önce oda ekleyin</option>}
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} — {r.room_type}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Görev tipi *</span>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="daily_clean">Günlük Temizlik</option>
              <option value="check_out_clean">Çıkış Sonrası Temizlik</option>
              <option value="deep_clean">Detaylı Temizlik</option>
              <option value="maintenance">Bakım</option>
              <option value="inspection">Kontrol</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Öncelik</span>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value={1}>Acil</option>
                <option value={2}>Normal</option>
                <option value={3}>Düşük</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tarih</span>
              <input type="date" value={queueDate} onChange={(e) => setQueueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Not</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Opsiyonel detay" />
          </label>
        </div>
        {error && <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting || rooms.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Oluştur
          </button>
        </div>
      </form>
    </div>
  );
}
