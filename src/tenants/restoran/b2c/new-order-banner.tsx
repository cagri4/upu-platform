"use client";

import Link from "next/link";
import { ShoppingBag, X } from "lucide-react";
import type { B2cOrderEvent } from "./use-b2c-orders-realtime";

function fmtEur(n: number): string {
  return `€${n.toLocaleString("tr-NL", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function NewOrderBanner({
  order,
  locale,
  token,
  onDismiss,
}: {
  order: B2cOrderEvent;
  locale: string;
  token: string;
  onDismiss: () => void;
}) {
  const deliveryLabel =
    order.delivery_type === "delivery"
      ? "Eve teslimat"
      : order.delivery_type === "pickup"
        ? "Gel-al"
        : "Masa";

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 animate-in slide-in-from-top-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-400 dark:border-emerald-600 p-4 relative">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
          aria-label="Kapat"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              🍽 Yeni sipariş!
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              #{order.order_number} · {order.customer_name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {deliveryLabel} · <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtEur(order.total)}</span>
            </div>
            <Link
              href={`/${locale}/restoran-siparisler?t=${encodeURIComponent(token)}`}
              className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
              onClick={onDismiss}
            >
              Siparişi gör →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
