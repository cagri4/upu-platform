"use client";

/**
 * Bayi Bildirim Merkezi — Sprint 1.
 *
 * Topbar bell dropdown'unun (NotificationBell) tarihsel görünüm sayfası.
 * Bell zaten `/tr/bildirimler` yönlendiriyor — bayi tenant için bu sayfa
 * (bayipanel route group altında) sidebar'dan da açılır.
 *
 * - notifications tablosundan list+filter (all/today/week/unread)
 * - Okundu/okunmadı toggle (item click veya "Tümünü okundu işaretle")
 * - payload.click_target varsa panel deeplink'e gider (sipariş onay vb.)
 * - Pagination: limit=50, offset increment ile "Daha fazla yükle"
 *
 * Backend hazır:
 *   GET  /api/notifications/list?filter=...&limit=...&offset=...
 *   POST /api/notifications/mark-read   { ids: [...] } | { all: true }
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

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

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all",    label: "Tümü" },
  { id: "today",  label: "Bugün" },
  { id: "week",   label: "Bu Hafta" },
  { id: "unread", label: "Okunmamış" },
];

const PAGE_SIZE = 50;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export default function BayiBildirimlerPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const initialFilter = (params.get("tab") === "history" ? "all" : (params.get("filter") as Filter | null)) || "all";

  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const load = useCallback(async (f: Filter, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const offset = append ? items.length : 0;
      const qs = new URLSearchParams({ filter: f, limit: String(PAGE_SIZE), offset: String(offset) });
      if (token) qs.set("t", token);
      const r = await fetch(`/api/notifications/list?${qs.toString()}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Bildirimler yüklenemedi."); return; }
      setTotal(d.total || 0);
      setItems(prev => append ? [...prev, ...(d.notifications || [])] : (d.notifications || []));
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [items.length, token]);

  useEffect(() => {
    void load(filter, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function toggleRead(n: Notification) {
    if (n.is_read || busyIds.has(n.id)) return;
    setBusyIds(prev => new Set(prev).add(n.id));
    // Optimistic
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: [n.id] }),
      });
    } finally {
      setBusyIds(prev => {
        const c = new Set(prev); c.delete(n.id); return c;
      });
    }
  }

  async function markAllRead() {
    const unreadIds = items.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setItems(prev => prev.map(x => ({ ...x, is_read: true })));
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ all: true }),
    });
  }

  function handleClick(n: Notification, e: React.MouseEvent) {
    void toggleRead(n);
    const target = n.payload?.click_target;
    if (!target) e.preventDefault();
  }

  const unreadCount = items.filter(n => !n.is_read).length;
  const canLoadMore = items.length < total && !loading;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">🔔 Bildirimler</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total > 0 ? `Toplam ${total} bildirim` : "Henüz bildiriminiz yok"}
            {unreadCount > 0 && <span className="ml-2 text-indigo-600 font-medium">· {unreadCount} okunmamış</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </header>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f.id
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/50 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 mb-3 text-sm text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl">
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "Okunmamış bildirim yok" : "Henüz bildirim yok"}
            description="Sistem aksiyon aldıkça (yeni sipariş, tahsilat, churn riski, kampanya tetiği) burada görünür."
            accent="indigo"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const href = n.payload?.click_target || "#";
            const isExternal = href.startsWith("http");
            return (
              <a
                key={n.id}
                href={href}
                onClick={(e) => handleClick(n, e)}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={`block bg-white dark:bg-slate-800 border rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition ${
                  n.is_read
                    ? "border-slate-200 dark:border-slate-800/50"
                    : "border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" aria-label="okunmadı" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.is_read ? "ml-5" : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{n.title}</h3>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-3">{n.body}</p>
                    {n.payload?.click_target && (
                      <span className="inline-block mt-2 text-xs text-indigo-600 font-medium">Aç →</span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}

          {canLoadMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => void load(filter, true)}
                disabled={loadingMore}
                className="px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? "Yükleniyor…" : `Daha fazla yükle (${items.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
