"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useParams } from "next/navigation";

interface Message {
  id: number;
  sender_type: "user" | "admin" | string;
  message: string;
  created_at: string;
}

interface Ticket {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

type Status = "loading" | "ready" | "sending" | "error";

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

export default function DestekDetayPage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");

  const threadRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/destek/${id}${tokenQs}`, { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setTicket(d.ticket);
      setMessages(d.messages || []);
      setStatus("ready");
      // Auto-scroll bottom
      setTimeout(() => {
        if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
      }, 50);
    } catch {
      setStatus("error"); setError("Bağlantı hatası.");
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, token]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`/api/destek/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: token || undefined,
          message: reply.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Gönderilemedi."); return; }
      setReply("");
      await load();
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  const backHref = token ? `/tr/destek?t=${encodeURIComponent(token)}` : "/tr/destek";

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error" || !ticket) return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <p className="text-slate-600 text-sm">{error || "Talep bulunamadı."}</p>
    <a href={backHref} className="inline-block mt-4 text-emerald-600 underline text-sm">← Destek</a>
  </Center>;

  const badge = STATUS_BADGE[ticket.status] || STATUS_BADGE.open;
  const isClosed = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-teal-700 to-emerald-900 text-white rounded-2xl p-5">
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-100 hover:text-white mb-2"
        >
          <span aria-hidden="true">←</span>
          <span>Destek</span>
        </a>
        <div className="flex items-start justify-between gap-3 mt-1">
          <h1 className="text-xl font-bold flex-1">#{ticket.id} {ticket.subject}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.bg}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-emerald-100 text-xs mt-1">Açıldı: {fmtDate(ticket.created_at)}</p>
      </div>

      <div ref={threadRef} className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-sm shadow-sm">
            Henüz mesaj yok.
          </div>
        ) : (
          messages.map(m => {
            const fromUser = m.sender_type === "user";
            return (
              <div key={m.id} className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  fromUser
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-white text-slate-900 rounded-bl-sm border border-slate-200"
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  <p className={`text-[10px] mt-1.5 ${fromUser ? "text-emerald-100" : "text-slate-400"}`}>
                    {fromUser ? "Siz" : "📬 Destek"} · {fmtDate(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isClosed ? (
        <div className="bg-slate-100 rounded-2xl p-4 text-center text-sm text-slate-600">
          Bu talep çözüldü. Yeni bir konu için "Destek" sayfasından yeni talep açabilirsiniz.
        </div>
      ) : (
        <form onSubmit={handleSend} className="bg-white rounded-2xl p-3 shadow-sm space-y-2 sticky bottom-0">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Mesaj yazın..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">⚠️ {error}</div>
          )}
          <button
            type="submit"
            disabled={status === "sending" || !reply.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95 transition"
          >
            {status === "sending" ? "Gönderiliyor..." : "📤 Gönder"}
          </button>
        </form>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
      {children}
    </div>
  );
}
