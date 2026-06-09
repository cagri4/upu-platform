"use client";

/**
 * Bildirim Merkezi (Faz 2 Sprint D).
 *
 * In-app feed; WA mirror için aynı veri kaynağı (notifications tablosu).
 * Faz 4'te WA bildirim wiring tetiklendiğinde aynı kayıt buraya da düşer.
 */

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, Filter } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  channelsSent: string[];
  createdAt: string;
  readAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  order_created: "Sipariş alındı",
  order_approved: "Sipariş onaylandı",
  order_rejected: "Sipariş reddedildi",
  order_shipped: "Kargoya verildi",
  order_delivered: "Teslim edildi",
  campaign_new: "Yeni kampanya",
  invoice_new: "Yeni fatura",
  payment_received: "Ödeme alındı",
  due_approaching: "Vade yaklaşıyor",
  due_overdue: "Vade geçti",
  credit_warning: "Kredi limit uyarısı",
  welcome: "Hoşgeldin",
};

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BayiBildirimlerPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markBusy, setMarkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({ unread: unreadOnly ? "1" : "" });
      const res = await fetch(`/api/bayi/bildirim?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setRows(d.items);
      setUnreadCount(d.unread || 0);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    setMarkBusy(true);
    try {
      await fetch("/api/bayi/bildirim", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      load();
    } finally {
      setMarkBusy(false);
    }
  }

  async function markOne(id: number) {
    await fetch("/api/bayi/bildirim", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bildirimler</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount > 0
              ? `${unreadCount} okunmamış bildirim`
              : "Tüm bildirimler okundu"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markBusy}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" />
            Tümünü okundu işaretle
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="accent-indigo-600"
            />
            Sadece okunmamışları göster
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Bell className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {unreadOnly ? "Okunmamış bildirim yok." : "Henüz bildirim yok."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-4 hover:bg-slate-50 ${
                  !n.isRead ? "bg-indigo-50/40" : ""
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    !n.isRead
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {!n.isRead ? (
                    <BellRing className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <p className="text-sm font-medium text-slate-900">
                      {n.title}
                    </p>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {formatTarih(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {TYPE_LABEL[n.type] || n.type}
                    {n.channelsSent.length > 0 && (
                      <span className="ml-2 text-slate-400">
                        · {n.channelsSent.join(", ")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {n.body}
                  </p>
                  {!n.isRead && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="mt-2 text-xs font-medium text-indigo-700 hover:underline"
                    >
                      Okundu işaretle
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
