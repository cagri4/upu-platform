"use client";

/**
 * /tr/bayi-siparislerim — Kullanıcı kendi sipariş listesi (B2B portal flow).
 *
 * Yeni bayi_dealer_orders endpoint'i kullanır (scope=mine). Durum filtre
 * tabs + sipariş detay modal + pending iken "İptal Et" buton.
 *
 * Admin/satis için ayrı sayfa: /tr/bayilik-siparisleri (gelen siparişler).
 */

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, ShoppingCart, X, Clock, Loader2 } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";
import { EmptyState } from "@/components/ui/EmptyState";

type Status = "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled" | "rejected";

interface OrderRow {
  id: string;
  status: Status;
  total_amount: number;
  created_at: string;
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
  order: OrderRow & { notes: string | null };
  items: OrderItem[];
  history: OrderHistory[];
  permissions: { canCancel: boolean };
}

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  pending:    { label: "Bekliyor",      cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  confirmed:  { label: "Onaylı",        cls: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400" },
  preparing:  { label: "Hazırlanıyor",  cls: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400" },
  shipped:    { label: "Yolda",         cls: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400" },
  delivered:  { label: "Teslim",        cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  cancelled:  { label: "İptal",         cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" },
  rejected:   { label: "Reddedildi",    cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" },
};

const TABS: Array<{ key: Status | "all"; label: string; codes: Status[] }> = [
  { key: "all",       label: "Tümü",        codes: [] },
  { key: "pending",   label: "Bekleyen",    codes: ["pending"] },
  { key: "confirmed", label: "Onaylı",      codes: ["confirmed", "preparing"] },
  { key: "shipped",   label: "Yolda",       codes: ["shipped"] },
  { key: "delivered", label: "Teslim",      codes: ["delivered"] },
  { key: "rejected",  label: "İptal/Red",   codes: ["cancelled", "rejected"] },
];

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function SiparislerimPage() {
  const [tab, setTab] = useState<Status | "all">("all");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    fetch("/api/bayi-dealer-orders/list?scope=mine", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        setRows(d.rows || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const tabDef = TABS.find((t) => t.key === tab);
  const filtered = !tabDef || tabDef.codes.length === 0
    ? rows
    : rows.filter((r) => (tabDef.codes as string[]).includes(r.status));

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={ClipboardList}
        title="Siparişlerim"
        subtitle="Verdiğin siparişlerin durumunu buradan takip et."
        ctaLabel="+ Yeni Sipariş"
        ctaHref="/tr/bayi-siparis-ver"
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
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300"
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
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pb-4">
          <EmptyState
            icon={ShoppingCart}
            title="Henüz sipariş yok"
            description="Bayilerinin sipariş vermesi için onları sisteme davet et — ya da kendi adına sipariş gir."
            cta={{ label: "+ Yeni Sipariş", href: "/tr/bayi-siparis-ver" }}
            secondary={{ label: "Bayi davet et →", href: "/tr/bayi-davet-et" }}
            accent="emerald"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const badge = STATUS_BADGE[o.status];
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOpenId(o.id)}
                className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-emerald-300 active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">#{o.id.slice(0, 8)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(o.created_at)}</div>
                    {o.rejection_reason && <div className="text-xs text-rose-600 mt-0.5 truncate">Sebep: {o.rejection_reason}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtTRY(o.total_amount)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {openId && (
        <DealerOrderModal orderId={openId} onClose={() => setOpenId(null)} onChanged={refetch} />
      )}
    </div>
  );
}

function DealerOrderModal({ orderId, onClose, onChanged }: { orderId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);

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

  async function cancel() {
    if (!confirm("Sipariş iptal edilsin mi?")) return;
    setActing(true);
    setError("");
    try {
      const r = await fetch(`/api/bayi-dealer-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "İptal edilemedi.");
        return;
      }
      onChanged();
      load();
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
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </header>

        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
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
                    {new Date(h.changed_at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {h.old_status || "—"} → <span className="font-medium">{h.new_status}</span>
                    {h.reason && <span className="text-rose-600 ml-1">({h.reason})</span>}
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">⚠️ {error}</div>}

            {data.permissions.canCancel && (
              <button
                type="button"
                onClick={cancel}
                disabled={acting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
              >
                {acting ? "..." : "Siparişi İptal Et"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
