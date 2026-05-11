"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface TicketSummary {
  id: number;
  subject: string;
  status: "open" | "in_progress" | "replied" | "resolved" | "closed" | string;
  created_at: string;
  updated_at: string;
  last_message: {
    message: string;
    sender_type: "user" | "admin" | string;
    created_at: string;
  } | null;
}

type Status = "loading" | "ready" | "saving" | "error";

const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  open: { label: "🔴 Yeni", bg: "bg-rose-100 text-rose-700" },
  in_progress: { label: "🟡 İşlemde", bg: "bg-amber-100 text-amber-700" },
  replied: { label: "🟢 Yanıtlandı", bg: "bg-emerald-100 text-emerald-700" },
  resolved: { label: "✅ Çözüldü", bg: "bg-slate-200 text-slate-700" },
  closed: { label: "Kapalı", bg: "bg-slate-100 text-slate-500" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function DestekPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  async function loadList() {
    try {
      const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/destek/init${tokenQs}`, { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setTickets(d.tickets || []);
      setStatus("ready");
    } catch {
      setStatus("error"); setError("Bağlantı hatası.");
    }
  }

  useEffect(() => { void loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError("Konu ve mesaj zorunlu.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/destek/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: token || undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Gönderilemedi."); return; }
      setSubject("");
      setMessage("");
      setShowForm(false);
      await loadList();
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  function detailHref(id: number) {
    return token ? `/tr/destek/${id}?t=${encodeURIComponent(token)}` : `/tr/destek/${id}`;
  }

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>⚠️ {error}</Center>;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-teal-700 to-emerald-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">🛟</div>
        <h1 className="text-xl font-bold">Destek</h1>
        <p className="text-emerald-100 text-sm mt-1">
          {tickets.length > 0 ? `${tickets.length} talep` : "Sorularınızı buradan bize iletin."}
        </p>
      </div>

      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setError(""); }}
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition font-semibold"
        >
          ➕ Yeni Talep
        </button>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Konu *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={100}
              placeholder="Kısa bir başlık"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            />
            <p className="text-xs text-slate-400 mt-1">{subject.length}/100</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Mesaj *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Sorununuzu detaylı yazın..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">{message.length}/2000</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95 transition"
            >
              {status === "saving" ? "Gönderiliyor..." : "Gönder"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="bg-white border border-slate-300 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {tickets.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3">🛟</div>
          <p className="font-semibold text-slate-900 mb-1">Henüz talebiniz yok</p>
          <p className="text-slate-500 text-sm">Sorularınızı veya geri bildirimlerinizi buradan iletebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => {
            const badge = STATUS_BADGE[t.status] || STATUS_BADGE.open;
            return (
              <a
                key={t.id}
                href={detailHref(t.id)}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 truncate flex-1">#{t.id} {t.subject}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>
                {t.last_message ? (
                  <p className="text-sm text-slate-600 leading-snug line-clamp-2">
                    {t.last_message.sender_type === "admin" ? "📬 " : "💬 "}
                    {t.last_message.message}
                  </p>
                ) : null}
                <p className="text-xs text-slate-400 mt-2">
                  {fmtDate(t.updated_at || t.created_at)}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
