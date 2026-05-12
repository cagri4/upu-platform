"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useParams } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  CircleAlert,
  MessageCircle,
  CheckCircle2,
  CircleDot,
  Clock,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

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

interface StatusVisual {
  label: string;
  Icon: typeof CircleAlert;
  classes: string;
}

function statusVisual(s: string): StatusVisual {
  if (s === "open") return {
    label: "Yeni",
    Icon: CircleAlert,
    classes: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
  };
  if (s === "in_progress") return {
    label: "İşlemde",
    Icon: Loader2,
    classes: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  if (s === "replied") return {
    label: "Yanıtlandı",
    Icon: MessageCircle,
    classes: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  };
  if (s === "resolved") return {
    label: "Çözüldü",
    Icon: CheckCircle2,
    classes: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  };
  return {
    label: "Kapalı",
    Icon: CircleDot,
    classes: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  };
}

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

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !ticket) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error || "Talep bulunamadı."}</p>
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Destek
        </a>
      </div>
    );
  }

  const sv = statusVisual(ticket.status);
  const isClosed = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="space-y-4 pb-4">
      {/* Header — banking */}
      <div className="flex items-center gap-3">
        <a
          href={backHref}
          className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
        </a>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-1 truncate">
          <span className="text-slate-500 dark:text-slate-400 font-normal">#{ticket.id}</span> {ticket.subject}
        </h1>
        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap flex items-center gap-1.5 ${sv.classes}`}>
          <sv.Icon className={`w-3.5 h-3.5 ${ticket.status === "in_progress" ? "animate-spin" : ""}`} strokeWidth={2.2} />
          {sv.label}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3 flex items-center gap-1">
        <Clock className="w-3 h-3" strokeWidth={2.2} /> Açıldı: {fmtDate(ticket.created_at)}
      </p>

      {/* Thread — chat bubbles banking */}
      <div ref={threadRef} className="space-y-3 max-h-[60vh] overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm shadow-sm border border-slate-200/70 dark:border-slate-800">
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
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-bl-sm border border-slate-200 dark:border-slate-800"
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${fromUser ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"}`}>
                    {fromUser ? (
                      <>
                        <Send className="w-2.5 h-2.5" strokeWidth={2.5} />
                        Siz
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-2.5 h-2.5" strokeWidth={2.5} />
                        Destek
                      </>
                    )}
                    <span>· {fmtDate(m.created_at)}</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isClosed ? (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Bu talep çözüldü. Yeni bir konu için &quot;Destek&quot; sayfasından yeni talep açabilirsiniz.
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 space-y-2 sticky bottom-0"
        >
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Mesaj yazın..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition resize-none"
          />
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={status === "sending" || !reply.trim()}
            className="flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
          >
            {status === "sending" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor</>
            ) : (
              <><Send className="w-4 h-4" strokeWidth={2.2} /> Gönder</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
