"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  LifeBuoy,
  Plus,
  Send,
  CircleAlert,
  Loader2,
  CheckCircle2,
  CircleDot,
  ChevronRight,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

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

  if (status === "loading") return <LoadingState />;
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition";

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Destek</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {tickets.length} kayıt
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        Sorularınızı veya geri bildirimlerinizi buradan bize iletin.
      </p>

      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setError(""); }}
          className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          Yeni Talep
        </button>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Konu *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={100}
              placeholder="Kısa bir başlık"
              className={inputCls}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subject.length}/100</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mesaj *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Sorununuzu detaylı yazın..."
              className={`${inputCls} resize-none`}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{message.length}/2000</p>
          </div>
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
            >
              {status === "saving" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor</>
              ) : (
                <><Send className="w-4 h-4" strokeWidth={2.2} /> Gönder</>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {tickets.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <LifeBuoy className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz talebiniz yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sorularınızı veya geri bildirimlerinizi buradan iletebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => {
            const sv = statusVisual(t.status);
            const isFromAdmin = t.last_message?.sender_type === "admin";
            return (
              <a
                key={t.id}
                href={detailHref(t.id)}
                className="block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="p-4 flex gap-3 items-start">
                  <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <LifeBuoy className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate flex-1">
                        <span className="text-slate-500 dark:text-slate-400 font-normal">#{t.id}</span> {t.subject}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap flex items-center gap-1 ${sv.classes}`}>
                        <sv.Icon className={`w-3 h-3 ${t.status === "in_progress" ? "animate-spin" : ""}`} strokeWidth={2.2} />
                        {sv.label}
                      </span>
                    </div>
                    {t.last_message && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug line-clamp-2 flex items-start gap-1.5">
                        {isFromAdmin ? (
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                        ) : (
                          <Send className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                        )}
                        <span className="min-w-0">{t.last_message.message}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      {fmtDate(t.updated_at || t.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0 self-center" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
