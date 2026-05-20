"use client";

/**
 * /tr/bayilik-siparisleri — Admin gelen sipariş yönetimi.
 *
 * Durum filtre tabs + sipariş satırları + detay modal (✅ Onayla / ❌ Reddet
 * / 📦 Hazırlanıyor / 🚚 Kargo / 📍 Teslim Edildi aksiyonları).
 *
 * Sadece admin + satis görür (BAYI_ROLE_REQUIREMENTS guard layout'ta).
 */

import { useEffect, useState, useCallback } from "react";
import { Inbox, Loader2, CheckCircle2, XCircle, Package, Truck, MapPin, Clock, X } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

type Status = "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled" | "rejected";

interface OrderRow {
  id: string;
  status: Status;
  total_amount: number;
  currency: string;
  created_at: string;
  dealer_name: string | null;
  dealer_phone: string | null;
  rejection_reason: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface OrderHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_at: string;
}

interface OrderDetail {
  order: OrderRow & { notes: string | null; dealer_user_id: string };
  items: OrderItem[];
  history: OrderHistory[];
  permissions: { canConfirm: boolean; canReject: boolean; canAdvance: boolean; canCancel: boolean };
}

const TABS: Array<{ key: Status | "all"; label: string }> = [
  { key: "pending",   label: "Bekleyen" },
  { key: "confirmed", label: "Onaylı" },
  { key: "preparing", label: "Hazırlanıyor" },
  { key: "shipped",   label: "Kargoda" },
  { key: "delivered", label: "Teslim" },
  { key: "rejected",  label: "Reddedildi" },
  { key: "all",       label: "Tümü" },
];

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  pending:    { label: "Bekliyor",      cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  confirmed:  { label: "Onaylı",        cls: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400" },
  preparing:  { label: "Hazırlanıyor",  cls: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400" },
  shipped:    { label: "Kargoda",       cls: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400" },
  delivered:  { label: "Teslim",        cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  cancelled:  { label: "İptal",         cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" },
  rejected:   { label: "Reddedildi",    cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" },
};

const NEXT_STATUS: Partial<Record<Status, { next: Status; label: string; Icon: typeof Package }>> = {
  confirmed: { next: "preparing", label: "Hazırlanıyor", Icon: Package },
  preparing: { next: "shipped",   label: "Kargoya Ver",  Icon: Truck },
  shipped:   { next: "delivered", label: "Teslim Edildi",Icon: MapPin },
};

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function BayilikSiparisleriPage() {
  const [tab, setTab] = useState<Status | "all">("pending");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    const qs = tab === "all" ? "scope=tenant" : `scope=tenant&status=${tab}`;
    fetch(`/api/bayi-dealer-orders/list?${qs}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        setRows(d.rows || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Inbox}
        title="Gelen Siparişler"
        subtitle="Bayilerden gelen siparişleri onayla, durumlarını güncelle."
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      ) : loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Bu sekmede sipariş yok.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-indigo-300 active:scale-[0.99] transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.dealer_name || "Bayi"}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      #{r.id.slice(0, 8)} · {fmtDate(r.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtTRY(r.total_amount)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openId && (
        <OrderDetailModal
          orderId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { refetch(); }}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ orderId, onClose, onChanged }: { orderId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/bayi-dealer-orders/${orderId}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Detay alınamadı.");
        setData(d as OrderDetail);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  async function callAction(path: string, body?: object) {
    setActing(true);
    setError("");
    try {
      const r = await fetch(`/api/bayi-dealer-orders/${orderId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body || {}),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "İşlem başarısız.");
        return;
      }
      onChanged();
      load();
      setRejectMode(false);
      setReason("");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sipariş Detayı</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </header>

        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
        ) : !data ? (
          <div className="p-6 text-sm text-rose-600">{error || "Detay yüklenemedi."}</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">#{data.order.id.slice(0, 8)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[data.order.status].cls}`}>
                  {STATUS_BADGE[data.order.status].label}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{data.order.dealer_name}</div>
              <div className="text-xs text-slate-500">{fmtDate(data.order.created_at)}</div>
              {data.order.notes && <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Not: {data.order.notes}</div>}
              {data.order.rejection_reason && <div className="text-xs text-rose-600 mt-1">Red sebebi: {data.order.rejection_reason}</div>}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ürünler</p>
              <div className="space-y-1.5">
                {data.items.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">{it.product_name}</div>
                      <div className="text-xs text-slate-500">{it.quantity} × {fmtTRY(it.unit_price)}</div>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtTRY(it.line_total)}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Toplam</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{fmtTRY(data.order.total_amount)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Durum Geçmişi
              </p>
              <div className="space-y-1">
                {data.history.map((h) => (
                  <div key={h.id} className="text-xs text-slate-600 dark:text-slate-400">
                    {fmtDate(h.changed_at)} — {h.old_status || "—"} → <span className="font-medium">{h.new_status}</span>
                    {h.reason && <span className="text-rose-600 ml-1">({h.reason})</span>}
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">⚠️ {error}</div>}

            {rejectMode ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Red sebebi (opsiyonel)"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setRejectMode(false); setReason(""); }} className="py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Vazgeç
                  </button>
                  <button type="button" disabled={acting} onClick={() => callAction("/reject", { reason })} className="py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white disabled:opacity-60">
                    {acting ? "..." : "Reddet"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {data.permissions.canConfirm && (
                  <button type="button" disabled={acting} onClick={() => callAction("/confirm")} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                    <CheckCircle2 className="w-4 h-4" /> Onayla
                  </button>
                )}
                {data.permissions.canReject && (
                  <button type="button" onClick={() => setRejectMode(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                    <XCircle className="w-4 h-4" /> Reddet
                  </button>
                )}
                {data.permissions.canAdvance && NEXT_STATUS[data.order.status] && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => callAction("/update-status", { status: NEXT_STATUS[data.order.status]?.next })}
                    className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                  >
                    {(() => { const N = NEXT_STATUS[data.order.status]; if (!N) return null; const I = N.Icon; return <I className="w-4 h-4" />; })()}
                    {NEXT_STATUS[data.order.status]?.label}
                  </button>
                )}
                {data.permissions.canCancel && (
                  <button type="button" disabled={acting} onClick={() => { if (confirm("Sipariş iptal edilsin mi?")) callAction("/cancel"); }} className="col-span-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    İptal Et
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
