"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Plus,
  Clock,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Check,
} from "lucide-react";
import { ReturnButtons } from "@/components/return-buttons";
import { LoadingState } from "@/components/banking";

const BOT_WA_NUMBER = "31644967207";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  related_customer_id: string | null;
  related_property_id: string | null;
  created_at: string;
}

type View = "list" | "form";
type Status = "loading" | "ready" | "saving" | "error";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface StatusVisual {
  label: string;
  Icon: typeof CheckCircle2;
  bg: string;
}

function statusVisual(s: string): StatusVisual {
  if (s === "sent") return { label: "Gönderildi", Icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" };
  if (s === "failed") return { label: "Başarısız", Icon: AlertCircle, bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400" };
  if (s === "cancelled") return { label: "İptal", Icon: XCircle, bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" };
  return { label: "Bekliyor", Icon: Loader2, bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" };
}

export default function TakvimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [items, setItems] = useState<CalendarEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(""); // datetime-local format

  async function loadList() {
    try {
      const res = await fetch(`/api/calendar/list?t=${encodeURIComponent(token)}`);
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setItems(d.events || []);
      setStatus("ready");
    } catch {
      setStatus("error"); setError("Bağlantı hatası.");
    }
  }

  useEffect(() => { void loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  function startNew() {
    setEditId(null);
    setTitle(""); setDescription(""); setScheduledLocal("");
    setError("");
    setView("form");
  }

  function startEdit(e: CalendarEvent) {
    setEditId(e.id);
    setTitle(e.title);
    setDescription(e.description || "");
    setScheduledLocal(isoToLocal(e.scheduled_at));
    setError("");
    setView("form");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError("");
    if (!title.trim()) { setStatus("ready"); setError("Başlık zorunlu."); return; }
    if (!scheduledLocal) { setStatus("ready"); setError("Tarih ve saat zorunlu."); return; }

    const localDate = new Date(scheduledLocal);
    if (localDate.getTime() < Date.now() - 60000) {
      setStatus("ready"); setError("Geçmiş zaman seçemezsiniz.");
      return;
    }

    try {
      const res = await fetch("/api/calendar/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ...(editId ? { id: editId } : {}),
          title,
          description: description.trim() || undefined,
          scheduled_at: localDate.toISOString(),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      await loadList();
      setView("list");
    } catch {
      setStatus("ready"); setError("Bağlantı hatası.");
    }
  }

  async function handleDelete(id: string) {
    const ev = items.find(e => e.id === id);
    const msg = ev && ev.status !== "pending"
      ? "Bu hatırlatıcıyı listeden kaldırmak istediğinize emin misiniz?"
      : "Bu hatırlatıcıyı iptal etmek istediğinize emin misiniz?";
    if (!confirm(msg)) return;
    setBusyId(id);
    try {
      await fetch("/api/calendar/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id }),
      });
      await loadList();
    } finally { setBusyId(null); }
  }

  if (status === "loading") return <LoadingState variant="card" />;
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────
  if (view === "form") {
    const inputBase = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500";
    return (
      <div className="space-y-5 pb-24">
        <button
          type="button"
          onClick={() => { setView("list"); setError(""); }}
          className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Geri
        </button>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {editId ? "Hatırlatıcıyı Düzenle" : "Yeni Hatırlatıcı"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          Zaman geldiğinde WhatsApp&apos;ınıza mesaj gönderirim.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Başlık *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              placeholder="Mehmet Bey'i ara"
              className={inputBase}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Tarih ve Saat *</label>
            <input
              type="datetime-local"
              value={scheduledLocal} onChange={e => setScheduledLocal(e.target.value)}
              className={inputBase}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dakika hassasiyetinde — tam o anda mesaj gelir.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Açıklama (opsiyonel)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
              placeholder="Sözleşme imzalanıp imzalanmadığını sor..."
              className={`${inputBase} resize-none`}
            />
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={status === "saving"}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-xl font-semibold text-base shadow-sm active:scale-[0.98] transition">
              <Check className="w-5 h-5" strokeWidth={2.5} />
              {status === "saving" ? "Kaydediliyor..." : (editId ? "Güncelle" : "Kaydet")}
            </button>
            <button type="button" onClick={() => { setView("list"); setError(""); }}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-4 rounded-xl text-base font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Geri
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────
  const pending = items.filter(e => e.status === "pending");
  const past = items.filter(e => e.status !== "pending");

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Takvim</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {pending.length > 0 ? `${pending.length} bekleyen` : `${items.length} kayıt`}
        </span>
      </div>

      <button
        onClick={startNew}
        className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Görev Ekle
      </button>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Calendar className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz hatırlatıcınız yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Yukarıdaki butonla ilk hatırlatıcınızı ekleyin.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">Bekleyen</p>
              {pending.map(ev => (
                <EventCard key={ev.id} ev={ev} busy={busyId === ev.id} onEdit={() => startEdit(ev)} onDelete={() => void handleDelete(ev.id)} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">Geçmiş</p>
              {past.map(ev => (
                <EventCard key={ev.id} ev={ev} busy={busyId === ev.id} onEdit={() => {}} onDelete={() => void handleDelete(ev.id)} past />
              ))}
            </div>
          )}
        </>
      )}

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}

function EventCard({ ev, busy, onEdit, onDelete, past = false }: {
  ev: CalendarEvent;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  past?: boolean;
}) {
  const sv = statusVisual(ev.status);
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 overflow-hidden ${past ? "opacity-70" : ""}`}>
      <div className="p-4 flex gap-3">
        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Calendar className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{ev.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1 ${sv.bg}`}>
              <sv.Icon className={`w-3 h-3 ${ev.status === "pending" ? "animate-spin" : ""}`} strokeWidth={2.2} />
              {sv.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={2.2} /> {fmtDate(ev.scheduled_at)}
          </p>
          {ev.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{ev.description}</p>
          )}
        </div>
      </div>
      {!past ? (
        <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-2">
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition"
          >
            <Pencil className="w-4 h-4" strokeWidth={2.2} /> Düzenle
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition border-l border-slate-100 dark:border-slate-800 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.2} /> {busy ? "..." : "Sil"}
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onDelete}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.2} /> {busy ? "Siliniyor..." : "Listeden kaldır"}
          </button>
        </div>
      )}
    </div>
  );
}
