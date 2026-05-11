"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  payload: { click_target?: string } | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function NotificationBell({ accentColor = "indigo", token = "" }: {
  accentColor?: string;
  token?: string;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchRecent = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications/recent?limit=10", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.notifications || []);
      setUnread(d.unread_count || 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void fetchRecent();
    const id = setInterval(() => void fetchRecent(), 30_000);
    return () => clearInterval(id);
  }, [fetchRecent]);

  // Outside click → close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ all: true }),
    });
    void fetchRecent();
  }

  async function handleItemClick(n: Notification, e: React.MouseEvent) {
    // Mark as read (optimistic)
    if (!n.is_read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread(c => Math.max(0, c - 1));
      void fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: [n.id] }),
      });
    }
    // Click target — payload veya default geçmiş sayfası
    const target = n.payload?.click_target;
    if (!target) {
      e.preventDefault();
      const fallback = token
        ? `/tr/bildirimler?t=${encodeURIComponent(token)}&tab=history`
        : `/tr/bildirimler?tab=history`;
      window.location.href = fallback;
    }
    // Else default <a> behavior follows
  }

  const allHref = token
    ? `/tr/bildirimler?t=${encodeURIComponent(token)}&tab=history`
    : `/tr/bildirimler?tab=history`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Bildirimler"
        title="Bildirimler"
      >
        <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl shadow-lg z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bildirimler</p>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Henüz bildiriminiz yok.
              </div>
            ) : (
              items.map(n => {
                const href = n.payload?.click_target || allHref;
                return (
                  <a
                    key={n.id}
                    href={href}
                    onClick={(e) => handleItemClick(n, e)}
                    className={`block px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${!n.is_read ? "bg-indigo-50/40" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" aria-label="okunmadı" />
                      )}
                      <div className={`flex-1 min-w-0 ${n.is_read ? "ml-3.5" : ""}`}>
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
          <a
            href={allHref}
            className="block px-4 py-3 text-center text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-slate-200 dark:border-slate-800/50"
          >
            Tümünü Gör →
          </a>
        </div>
      )}
    </div>
  );
}
