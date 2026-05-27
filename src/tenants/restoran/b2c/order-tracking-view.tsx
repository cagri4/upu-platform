"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  Phone,
  ArrowLeft,
  AlertTriangle,
  CreditCard,
  Wallet,
  Banknote,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export interface OrderTracking {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: Record<string, string | null> | null;
  items: Array<{
    name: string;
    variant_name: string | null;
    addons: Array<{ name: string; price: number }>;
    quantity: number;
    unit_price: number;
    total: number;
    notes: string | null;
  }>;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  estimatedReadyAt: string | null;
  createdAt: string;
}

const STATUS_ORDER = ["received", "preparing", "ready", "out_for_delivery", "delivered"];

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Ödeme bekleniyor",
  received: "Alındı",
  preparing: "Hazırlanıyor",
  ready: "Hazır",
  out_for_delivery: "Yolda",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

function fmtEur(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function OrderTrackingView({
  locale,
  slug,
  brandName,
  primaryColor,
  restaurantPhone,
  order: initialOrder,
}: {
  locale: string;
  slug: string;
  brandName: string;
  primaryColor: string;
  restaurantPhone: string | null;
  order: OrderTracking;
}) {
  const [order, setOrder] = useState<OrderTracking>(initialOrder);

  // Supabase Realtime subscription — sipariş durumu canlı update
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    const sb = createBrowserClient(supabaseUrl, anonKey);
    const channel = sb
      .channel(`order-${order.orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rst_b2c_orders",
          filter: `id=eq.${order.orderId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          setOrder((prev) => ({
            ...prev,
            status: String(next.status || prev.status),
            paymentStatus: String(next.payment_status || prev.paymentStatus),
            estimatedReadyAt: (next.estimated_ready_at as string) || prev.estimatedReadyAt,
          }));
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [order.orderId]);

  const isCancelled = order.status === "cancelled";
  const isPendingPayment = order.status === "pending_payment";
  const currentStepIdx = STATUS_ORDER.indexOf(order.status);

  const heroText = isCancelled
    ? "Sipariş iptal edildi"
    : isPendingPayment
      ? "Ödeme bekleniyor"
      : order.status === "delivered"
        ? "Siparişiniz teslim edildi"
        : "Siparişiniz alındı!";

  return (
    <main className="max-w-2xl mx-auto pb-16">
      {/* Header */}
      <header className="px-4 py-3 flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link
          href={`/${locale}/r/${slug}`}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          aria-label="Anasayfa"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{brandName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Sipariş takip</div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Hero */}
        <section
          className="text-white rounded-2xl p-6 shadow-md"
          style={{
            background: isCancelled
              ? "linear-gradient(135deg, #94a3b8, #475569)"
              : `linear-gradient(135deg, ${primaryColor}, color-mix(in oklab, ${primaryColor} 70%, black 30%))`,
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              {isCancelled ? (
                <AlertTriangle className="w-6 h-6" strokeWidth={2.2} />
              ) : (
                <CheckCircle2 className="w-6 h-6" strokeWidth={2.2} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{heroText}</h1>
              <p className="text-white/90 text-sm mt-1">
                Sipariş <span className="font-semibold">#{order.orderNumber}</span>
              </p>
              {!isCancelled && order.estimatedReadyAt && (
                <p className="text-white/95 text-sm mt-2">
                  Tahmini {order.deliveryType === "delivery" ? "teslim" : "hazır"}:{" "}
                  <span className="font-semibold">{fmtTime(order.estimatedReadyAt)}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Ödeme uyarısı */}
        {isPendingPayment && order.paymentStatus === "pending" && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-2xl px-4 py-3 text-sm flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <div>
              Ödemeniz Mollie tarafından işleniyor. Birkaç dakika içinde durum güncellenir.
            </div>
          </div>
        )}

        {/* Status progress */}
        {!isCancelled && !isPendingPayment && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Durum
            </div>
            <div className="space-y-3">
              {STATUS_ORDER.filter((s) => {
                // delivery dışında 'out_for_delivery' adımını gösterme
                if (s === "out_for_delivery" && order.deliveryType !== "delivery") return false;
                return true;
              }).map((step, idx, arr) => {
                const isPast = idx <= currentStepIdx;
                const isActive = idx === currentStepIdx;
                const isFuture = idx > currentStepIdx;
                const Icon = step === "received" ? CheckCircle2 : step === "preparing" ? ChefHat : step === "ready" ? Clock : step === "out_for_delivery" ? Bike : CheckCircle2;

                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                        isFuture
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                          : ""
                      }`}
                      style={
                        isPast && !isFuture
                          ? { backgroundColor: isActive ? primaryColor : `${primaryColor}33`, color: isActive ? "white" : primaryColor }
                          : undefined
                      }
                    >
                      <Icon className="w-5 h-5" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isFuture ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"}`}>
                        {STATUS_LABEL[step] || step}
                      </div>
                      {isActive && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Şu an
                        </div>
                      )}
                    </div>
                    {idx < arr.length - 1 && (
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Restoran iletişim */}
        {restaurantPhone && (
          <a
            href={`tel:${restaurantPhone}`}
            className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm rounded-2xl px-5 py-3.5 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Phone className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Restoran'ı ara
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{restaurantPhone}</div>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </a>
        )}

        {/* Sipariş özeti */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Sipariş özeti
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {order.items.map((item, i) => (
              <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.quantity}× {item.name}
                      {item.variant_name && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal"> · {item.variant_name}</span>
                      )}
                    </div>
                    {item.addons.length > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        + {item.addons.map((a) => a.name).join(", ")}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                        “{item.notes}”
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-shrink-0">
                    {fmtEur(item.total)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200/70 dark:border-slate-800 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Ara toplam</span>
              <span>{fmtEur(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Teslimat</span>
                <span>{fmtEur(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-slate-200/70 dark:border-slate-800 mt-1.5">
              <span className="text-slate-900 dark:text-slate-100">Toplam</span>
              <span style={{ color: primaryColor }}>{fmtEur(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Ödeme bilgisi */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"
            >
              {order.paymentMethod === "ideal" || order.paymentMethod === "card" ? (
                <CreditCard className="w-5 h-5" strokeWidth={2.2} />
              ) : order.paymentMethod === "cash_on_delivery" ? (
                <Banknote className="w-5 h-5" strokeWidth={2.2} />
              ) : (
                <Wallet className="w-5 h-5" strokeWidth={2.2} />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {order.paymentMethod === "ideal" && "iDEAL"}
                {order.paymentMethod === "card" && "Kart"}
                {order.paymentMethod === "cash_on_delivery" && "Kapıda nakit"}
                {order.paymentMethod === "card_on_delivery" && "Kapıda kart"}
                {order.paymentMethod === "dine_in_later" && "Masada öderim"}
              </div>
              <div className={`text-xs font-medium mt-0.5 ${
                order.paymentStatus === "paid"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : order.paymentStatus === "failed" || order.paymentStatus === "expired"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 dark:text-slate-400"
              }`}>
                {order.paymentStatus === "paid" && "✓ Ödendi"}
                {order.paymentStatus === "pending" && "Bekliyor"}
                {order.paymentStatus === "failed" && "Başarısız"}
                {order.paymentStatus === "expired" && "Süresi doldu"}
              </div>
            </div>
          </div>
        </section>

        {/* Teslimat bilgisi */}
        {order.deliveryType === "delivery" && order.deliveryAddress && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Teslimat adresi
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="font-medium text-slate-900 dark:text-slate-100">{order.customerName}</div>
              <div>{order.customerPhone}</div>
              <div className="mt-1">
                {order.deliveryAddress.street} {order.deliveryAddress.no}
                {order.deliveryAddress.apartment ? ` / ${order.deliveryAddress.apartment}` : ""}
              </div>
              <div>
                {order.deliveryAddress.postal} {order.deliveryAddress.city}
              </div>
              {order.deliveryAddress.note && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                  Not: {order.deliveryAddress.note}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4">
          UPU restoran ile teslim alındı
        </div>
      </div>
    </main>
  );
}
