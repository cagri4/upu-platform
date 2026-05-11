"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

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
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 whitespace-nowrap ${
              filter === f.id
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
        {hasUnread && (
          <button
            onClick={() => void markAllRead()}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 whitespace-nowrap"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      {status === "loading" ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm shadow-sm">⏳ Yükleniyor...</div>
      ) : status === "error" ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-rose-600 text-sm shadow-sm">⚠️ {error}</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm shadow-sm">
          {filter === "unread" ? "Okunmamış bildiriminiz yok." : "Henüz bildiriminiz yok."}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
            const targetRaw = n.payload?.click_target;
            const href = targetRaw
              ? targetRaw + (targetRaw.includes("?") ? "&" : "?") + (token ? `t=${encodeURIComponent(token)}` : "")
              : `#`;
            return (
              <a
                key={n.id}
                href={href}
                onClick={(e) => handleClick(n, e)}
                className={`block bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition border-l-4 ${
                  n.is_read ? "border-slate-200 dark:border-slate-800/50" : "border-amber-500 bg-amber-50/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" aria-label="okunmadı" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.is_read ? "ml-2.5" : ""}`}>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{n.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-snug whitespace-pre-line">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-2">{fmtDate(n.created_at)}</p>
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
