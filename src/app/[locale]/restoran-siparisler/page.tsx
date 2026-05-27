"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShoppingBag,
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Banknote,
  CreditCard,
  Wallet,
} from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import { HeroBanner, Skeleton } from "@/tenants/restoran/components/banking";
import { useB2cOrdersRealtime } from "@/tenants/restoran/b2c/use-b2c-orders-realtime";

interface B2cOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: "delivery" | "pickup" | "dine_in";
  delivery_address: Record<string, string | null> | null;
  items: Array<{
    name: string;
    variant_name: string | null;
    addons: Array<{ name: string; price: number }>;
    quantity: number;
    notes: string | null;
    total: number;
  }>;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  estimated_ready_at: string | null;
  source: string;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  received: { label: "Alındı", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950/40", Icon: ShoppingBag },
  preparing: { label: "Hazırlanıyor", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-950/40", Icon: ChefHat },
  ready: { label: "Hazır", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950/40", Icon: Clock },
  out_for_delivery: { label: "Yolda", color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-100 dark:bg-indigo-950/40", Icon: Bike },
  delivered: { label: "Teslim edildi", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800", Icon: CheckCircle2 },
  cancelled: { label: "İptal", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-950/40", Icon: XCircle },
};

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  received: [{ label: "Hazırlamaya başla", status: "preparing" }],
  preparing: [{ label: "Hazır olarak işaretle", status: "ready" }],
  ready: [
    { label: "Yolda (kurye)", status: "out_for_delivery" },
    { label: "Teslim edildi", status: "delivered" },
  ],
  out_for_delivery: [{ label: "Teslim edildi", status: "delivered" }],
};

function fmtEur(n: number): string {
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function B2cOrdersPage() {
  return (
    <RestoranPanelShell>
      {({ token, init }) => <OrdersView token={token} restaurantId={init.restaurantId} />}
    </RestoranPanelShell>
  );
}

function OrdersView({ token, restaurantId }: { token: string; restaurantId: string | null }) {
  const [orders, setOrders] = useState<B2cOrderRow[] | null>(null);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<"active" | "all" | "today">("active");
  const { newOrder, updateCounter, dismissNew } = useB2cOrdersRealtime(restaurantId);

  const fetchOrders = useCallback(async () => {
    try {
      const qs =
        filter === "active"
          ? "received,preparing,ready,out_for_delivery"
          : filter === "today"
            ? "received,preparing,ready,out_for_delivery,delivered,cancelled"
            : "received,preparing,ready,out_for_delivery,delivered,cancelled";
      const res = await fetch(`/api/restoran-panel/b2c-orders?t=${token}&status=${qs}&limit=100`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Yüklenemedi.");
        return;
      }
      setOrders(json.orders as B2cOrderRow[]);
    } catch {
      setError("Bağlantı hatası.");
    }
  }, [token, filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, updateCounter, newOrder]);

  async function changeStatus(orderId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/restoran-panel/b2c-orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Status güncellenemedi.");
        return;
      }
      fetchOrders();
    } catch {
      alert("Bağlantı hatası.");
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const visible = (orders || []).filter((o) => {
    if (filter === "today") return o.created_at.startsWith(todayStr);
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {newOrder && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>
            🔔 Yeni sipariş: <b>#{newOrder.order_number}</b> · {newOrder.customer_name} · {fmtEur(newOrder.total)}
          </span>
          <button
            type="button"
            onClick={dismissNew}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Tamam
          </button>
        </div>
      )}

      <HeroBanner
        Icon={ShoppingBag}
        title="Online Siparişler"
        subtitle={
          orders
            ? `${visible.length} ${filter === "active" ? "aktif" : filter === "today" ? "bugün" : "toplam"} sipariş`
            : "Siparişler yükleniyor…"
        }
      />

      {/* Filter chip'leri */}
      <div className="flex gap-2">
        {(["active", "today", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            {f === "active" ? "Aktif" : f === "today" ? "Bugün" : "Tümü"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!orders && !error && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="h-32" />
          ))}
        </div>
      )}

      {orders && visible.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-10 text-center text-slate-500 dark:text-slate-400 text-sm">
          <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" strokeWidth={1.5} />
          {filter === "active"
            ? "Aktif sipariş yok. Müşteri sipariş verdiğinde burada görünecek."
            : "Bu filtreye uyan sipariş yok."}
        </div>
      )}

      {visible.map((order) => (
        <OrderCard key={order.id} order={order} onStatusChange={(s) => changeStatus(order.id, s)} />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
}: {
  order: B2cOrderRow;
  onStatusChange: (status: string) => void;
}) {
  const meta = STATUS_META[order.status] || STATUS_META.received;
  const StatusIcon = meta.Icon;
  const transitions = NEXT_STATUS[order.status] || [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}
          >
            <StatusIcon className="w-3.5 h-3.5" strokeWidth={2.4} />
            {meta.label}
          </span>
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            #{order.order_number}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{fmtTime(order.created_at)}</span>
        </div>
        <div className="text-base font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
          {fmtEur(order.total)}
        </div>
      </div>

      {/* Customer + delivery */}
      <div className="px-5 py-3 space-y-1.5 text-sm border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">{order.customer_name}</span>
          <a
            href={`tel:${order.customer_phone}`}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
          >
            <Phone className="w-3 h-3" strokeWidth={2.4} />
            {order.customer_phone}
          </a>
        </div>
        {order.delivery_type === "delivery" && order.delivery_address && (
          <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <span>
              {order.delivery_address.street} {order.delivery_address.no}
              {order.delivery_address.apartment ? ` / ${order.delivery_address.apartment}` : ""},{" "}
              {order.delivery_address.postal} {order.delivery_address.city}
              {order.delivery_address.note ? ` (${order.delivery_address.note})` : ""}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {order.delivery_type === "delivery" ? "🛵 Eve teslim" : order.delivery_type === "pickup" ? "🥡 Gel-al" : "🍽 Masa"}
          </span>
          <span className="inline-flex items-center gap-1">
            {order.payment_method === "ideal" || order.payment_method === "card" ? (
              <CreditCard className="w-3 h-3" strokeWidth={2.4} />
            ) : order.payment_method === "cash_on_delivery" ? (
              <Banknote className="w-3 h-3" strokeWidth={2.4} />
            ) : (
              <Wallet className="w-3 h-3" strokeWidth={2.4} />
            )}
            {order.payment_method === "ideal" && "iDEAL"}
            {order.payment_method === "card" && "Kart"}
            {order.payment_method === "cash_on_delivery" && "Kapıda nakit"}
            {order.payment_method === "card_on_delivery" && "Kapıda kart"}
            {order.payment_method === "dine_in_later" && "Masada"}
          </span>
          {order.payment_status === "paid" && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Ödendi</span>
          )}
          {order.payment_status === "pending" &&
            (order.payment_method === "ideal" || order.payment_method === "card") && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Bekliyor</span>
            )}
          {order.estimated_ready_at && (
            <span>· Tahmini hazır {fmtTime(order.estimated_ready_at)}</span>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="px-5 py-3 space-y-1.5 text-sm">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 dark:text-slate-100">
                <span className="font-semibold">{item.quantity}×</span> {item.name}
                {item.variant_name && (
                  <span className="text-slate-500 dark:text-slate-400 font-normal"> · {item.variant_name}</span>
                )}
              </div>
              {item.addons.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  + {item.addons.map((a) => a.name).join(", ")}
                </div>
              )}
              {item.notes && (
                <div className="text-xs text-amber-700 dark:text-amber-400 italic">
                  📝 {item.notes}
                </div>
              )}
            </div>
            <div className="text-slate-700 dark:text-slate-300 font-medium flex-shrink-0">
              {fmtEur(item.total)}
            </div>
          </li>
        ))}
        {order.notes && (
          <li className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-amber-700 dark:text-amber-400 italic">
              📝 Sipariş notu: {order.notes}
            </span>
          </li>
        )}
      </ul>

      {/* Actions */}
      {transitions.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-2">
          {transitions.map((t) => (
            <button
              key={t.status}
              type="button"
              onClick={() => onStatusChange(t.status)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition active:scale-95"
            >
              {t.label}
            </button>
          ))}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Bu siparişi iptal etmek istediğinize emin misiniz?")) {
                  onStatusChange("cancelled");
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
            >
              İptal et
            </button>
          )}
        </div>
      )}
    </div>
  );
}
