"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReturnButtons } from "@/components/return-buttons";

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
  // Supabase ISO → datetime-local input value (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    // cookie-aware: token yoksa endpoint cookie session kabul eder
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

    // datetime-local → local Date → ISO
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

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>⚠️ {error}</Center>;

  // ── FORM VIEW ──────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-sky-700 to-cyan-900 text-white rounded-2xl p-5">
          <div className="text-3xl mb-1">📅</div>
          <h1 className="text-xl font-bold">{editId ? "Hatırlatıcıyı Düzenle" : "Yeni Hatırlatıcı"}</h1>
          <p className="text-sky-200 text-sm mt-1">Zaman geldiğinde WhatsApp&apos;ınıza mesaj gönderirim.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">Başlık *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              placeholder="Mehmet Bey'i ara"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">Tarih ve Saat *</label>
            <input
              type="datetime-local"
              value={scheduledLocal} onChange={e => setScheduledLocal(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            />
            <p className="text-xs text-slate-500 mt-1">Dakika hassasiyetinde — tam o anda mesaj gelir.</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">Açıklama (opsiyonel)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
              placeholder="Sözleşme imzalanıp imzalanmadığını sor..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={status === "saving"}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-semibold text-base shadow-lg active:scale-95 transition">
              {status === "saving" ? "Kaydediliyor..." : (editId ? "✅ Güncelle" : "✅ Kaydet")}
            </button>
            <button type="button" onClick={() => { setView("list"); setError(""); }}
              className="bg-white dark:bg-slate-800 border border-slate-300 text-slate-700 py-4 rounded-xl text-base font-medium hover:bg-slate-50 transition">
              ← Geri
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
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">📅</div>
        <h1 className="text-xl font-bold">Takvim</h1>
        <p className="text-sky-200 text-sm mt-1">
          {pending.length > 0 ? `${pending.length} bekleyen hatırlatıcı` : "Hatırlatıcılarım"}
        </p>
      </div>

      <button
        onClick={startNew}
        className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition font-semibold"
      >
        ➕ Görev Ekle
      </button>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3">📅</div>
          <p className="font-semibold text-slate-900 mb-1">Henüz hatırlatıcınız yok</p>
          <p className="text-slate-500 text-sm">Yukarıdaki butonla ilk hatırlatıcınızı ekleyin.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bekleyen</p>
              {pending.map(ev => (
                <EventCard key={ev.id} ev={ev} busy={busyId === ev.id} onEdit={() => startEdit(ev)} onDelete={() => void handleDelete(ev.id)} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Geçmiş</p>
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
  const statusBadge = ev.status === "sent" ? "✅ Gönderildi" : ev.status === "failed" ? "⚠️ Başarısız" : ev.status === "cancelled" ? "İptal" : "⏳ Bekliyor";
  const statusBg = ev.status === "sent" ? "bg-emerald-100 text-emerald-700"
    : ev.status === "failed" ? "bg-red-100 text-red-700"
    : ev.status === "cancelled" ? "bg-slate-200 text-slate-500"
    : "bg-amber-100 text-amber-700";

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${past ? "opacity-70" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-slate-900 truncate">{ev.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusBg}`}>
            {statusBadge}
          </span>
        </div>
        <p className="text-xs text-slate-500">⏰ {fmtDate(ev.scheduled_at)}</p>
        {ev.description && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{ev.description}</p>}
      </div>
      {!past ? (
        <div className="border-t border-slate-100 grid grid-cols-2">
          <button
            onClick={onEdit}
            className="py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 transition"
          >
            ✏️ Düzenle
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition border-l border-slate-100 disabled:opacity-50"
          >
            🗑 {busy ? "..." : "Sil"}
          </button>
        </div>
      ) : (
        // Geçmiş hatırlatma: değiştirilemez, sadece listeden kaldırılabilir.
        <div className="border-t border-slate-100">
          <button
            onClick={onDelete}
            disabled={busy}
            className="w-full py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition disabled:opacity-50"
          >
            🗑 {busy ? "Siliniyor..." : "Listeden kaldır"}
          </button>
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm">
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
