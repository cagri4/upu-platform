"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Inbox, AlertTriangle, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/banking";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  payload: { click_target?: string } | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

type Filter = "all" | "today" | "week" | "unread";
type Status = "loading" | "ready" | "error";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "today", label: "Bugün" },
  { id: "week", label: "Hafta" },
  { id: "unread", label: "Okunmamış" },
];

export function HistoryView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch(`/api/notifications/list?filter=${filter}&limit=100`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setItems(d.notifications || []);
      setStatus("ready");
    } catch {
      setStatus("error"); setError("Bağlantı hatası.");
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ all: true }),
    });
    void load();
  }

  async function handleClick(n: Notification, e: React.MouseEvent) {
    if (!n.is_read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      void fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: [n.id] }),
      });
    }
    if (!n.payload?.click_target) {
      e.preventDefault();
    }
  }

  const hasUnread = items.some(n => !n.is_read);

  return (
    <div className="space-y-3 pb-8">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition active:scale-[0.97] ${
              filter === f.id
                ? "bg-emerald-600 text-white border border-emerald-600"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500"
            }`}
          >
            {f.label}
          </button>
        ))}
        {hasUnread && (
          <button
            onClick={() => void markAllRead()}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition"
          >
            <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span className="hidden sm:inline">Tümünü okundu işaretle</span>
            <span className="sm:hidden">Hepsi okundu</span>
          </button>
        )}
      </div>

      {status === "loading" ? (
        <div className="space-y-2">
          <Skeleton height="h-20" />
          <Skeleton height="h-20" />
          <Skeleton height="h-20" />
        </div>
      ) : status === "error" ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
          <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Inbox className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            {filter === "unread" ? "Okunmamış bildiriminiz yok" : "Henüz bildiriminiz yok"}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Yeni bildirimler burada görünecek.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const targetRaw = n.payload?.click_target;
            const href = targetRaw
              ? targetRaw + (targetRaw.includes("?") ? "&" : "?") + (token ? `t=${encodeURIComponent(token)}` : "")
              : `#`;
            return (
              <a
                key={n.id}
                href={href}
                onClick={(e) => handleClick(n, e)}
                className={`block bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition border ${
                  n.is_read
                    ? "border-slate-200/70 dark:border-slate-800"
                    : "border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${
                    n.is_read
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    <Bell className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex-1 min-w-0">
                        {n.title}
                      </h3>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" aria-label="okunmadı" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-snug whitespace-pre-line">{n.body}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{fmtDate(n.created_at)}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
