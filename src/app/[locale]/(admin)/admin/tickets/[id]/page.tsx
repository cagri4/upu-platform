"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Message {
  id: number;
  sender_type: "user" | "admin" | string;
  message: string;
  internal_note: boolean;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string | null;
  tier: string;
}

interface Ticket {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: "open", label: "Açık" },
  { id: "in_progress", label: "İşlemde" },
  { id: "replied", label: "Yanıtlandı" },
  { id: "resolved", label: "Çözüldü" },
  { id: "closed", label: "Kapalı" },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminTicketDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, { credentials: "same-origin" });
      const d = await res.json();
      if (res.ok) {
        setTicket(d.ticket);
        setUser(d.user);
        setMessages(d.messages || []);
      } else {
        setError(d.error || "Yüklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: reply.trim(), internal_note: internal }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gönderilemedi."); return; }
      setReply("");
      setInternal(false);
      await load();
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(newStatus: string) {
    setError("");
    try {
      const res = await fetch(`/api/admin/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Status değiştirilemedi."); return; }
      await load();
    } catch {
      setError("Bağlantı hatası.");
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-900 text-slate-500 flex items-center justify-center">Yükleniyor...</div>;
  if (!ticket || !user) return <div className="min-h-screen bg-slate-900 text-slate-500 flex items-center justify-center">{error || "Talep bulunamadı."}</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin/tickets" className="text-slate-400 hover:text-white text-sm">← Destek Talepleri</a>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 text-sm font-mono">#{ticket.id}</span>
          </div>
          <select
            value={ticket.status}
            onChange={e => void changeStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        {/* Left: user info */}
        <aside className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Kullanıcı</p>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-slate-500 text-xs">Ad Soyad</div>
                <div className="font-medium">{user.name}</div>
              </div>
              {user.phone && (
                <div>
                  <div className="text-slate-500 text-xs">Telefon</div>
                  <a href={`https://wa.me/${user.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-mono">
                    {user.phone}
                  </a>
                </div>
              )}
              {user.email && (
                <div>
                  <div className="text-slate-500 text-xs">E-posta</div>
                  <a href={`mailto:${user.email}`} className="text-indigo-400 hover:text-indigo-300 break-all">{user.email}</a>
                </div>
              )}
              <div>
                <div className="text-slate-500 text-xs">Plan</div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    user.tier === "pro" ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" :
                    user.tier === "trial" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                    "bg-slate-700 text-slate-400 border border-slate-600"
                  }`}>{user.tier.toUpperCase()}</span>
                </div>
              </div>
              {user.created_at && (
                <div>
                  <div className="text-slate-500 text-xs">Kayıt</div>
                  <div className="text-slate-300">{fmt(user.created_at)}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right: thread + reply */}
        <section className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-bold">{ticket.subject}</h2>
            <p className="text-xs text-slate-500 mt-1">Açıldı: {fmt(ticket.created_at)}</p>
          </div>

          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm border border-slate-700">Henüz mesaj yok.</div>
            ) : messages.map(m => {
              const fromUser = m.sender_type === "user";
              return (
                <div key={m.id} className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    m.internal_note
                      ? "bg-amber-900/40 border border-amber-500/40 text-amber-100"
                      : fromUser
                        ? "bg-slate-800 border border-slate-700 text-slate-200"
                        : "bg-indigo-600 text-white"
                  }`}>
                    {m.internal_note && (
                      <div className="text-[10px] uppercase tracking-wide font-bold text-amber-300 mb-1">📝 Internal note</div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                    <p className={`text-[10px] mt-2 ${fromUser ? "text-slate-500" : m.internal_note ? "text-amber-200/70" : "text-indigo-200"}`}>
                      {fromUser ? "👤 Kullanıcı" : "📬 Admin"} · {fmt(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3 sticky bottom-4">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={internal ? "Internal note (kullanıcıya görünmez)..." : "Yanıt yazın..."}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500"
            />
            {error && <div className="bg-red-900/40 border border-red-500/40 text-red-200 px-3 py-2 rounded text-xs">⚠️ {error}</div>}
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={e => setInternal(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>📝 Internal note (kullanıcıya görünmez)</span>
              </label>
              <button
                onClick={() => void handleSend()}
                disabled={sending || !reply.trim()}
                className={`px-5 py-2 rounded-lg font-semibold text-sm shadow disabled:opacity-50 ${
                  internal
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {sending ? "Gönderiliyor..." : internal ? "Internal note ekle" : "📤 Gönder"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
