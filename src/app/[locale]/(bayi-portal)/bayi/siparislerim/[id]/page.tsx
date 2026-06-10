"use client";

/**
 * Bayi sipariş detay (Faz 2 Sprint D).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Repeat,
  Printer,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
  notes: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  shipmentCarrier?: string | null;
  shipmentTrackingNo?: string | null;
  shipmentTrackingUrl?: string | null;
  shippedAt?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
}

const CARRIER_LABEL: Record<string, string> = {
  aras: "Aras Kargo",
  yurtici: "Yurtiçi Kargo",
  mng: "MNG Kargo",
};

interface OrderItem {
  id: string;
  productId: string | null;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  totalPrice: number;
  campaignName: string | null;
}

interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  preparing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  cancelled: "İptal",
};

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BayiSiparisDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bayi/siparisler/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setOrder(d.order);
      setItems(d.items || []);
      setHistory(d.history || []);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function reorder() {
    setReordering(true);
    try {
      const res = await fetch(`/api/bayi/siparisler/${id}/tekrar`, {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Tekrar sipariş başarısız.");
        return;
      }
      router.push(`/${locale}/bayi/sepet`);
    } finally {
      setReordering(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !order) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!order) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/bayi/siparislerim`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 tabular-nums">
            #{order.orderNumber}
          </h1>
          <StatusBadge tone={STATUS_TONE[order.status] || "neutral"}>
            {STATUS_LABEL[order.status] || order.status}
          </StatusBadge>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Yazdır
          </button>
          <button
            onClick={reorder}
            disabled={reordering}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Repeat className="h-4 w-4" />
            {reordering ? "Ekleniyor…" : "Tekrar Sipariş"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sipariş Bilgisi
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Oluşturuldu: {formatTarih(order.createdAt)}
          </p>
          {order.approvedAt && (
            <p className="text-xs text-emerald-700">
              Onaylandı: {formatTarih(order.approvedAt)}
            </p>
          )}
          {order.rejectedAt && (
            <>
              <p className="text-xs text-rose-700">
                Reddedildi: {formatTarih(order.rejectedAt)}
              </p>
              {order.rejectReason && (
                <p className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
                  Sebep: {order.rejectReason}
                </p>
              )}
            </>
          )}
          {order.couponCode && (
            <p className="mt-2 text-xs">
              Kupon: <code className="font-mono">{order.couponCode}</code>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Notlar
          </p>
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
            {order.notes || <span className="text-slate-400">—</span>}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tutarlar
          </p>
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            <p className="flex justify-between text-slate-600">
              <span>Ara toplam</span>
              <span>{formatPara(order.subtotal)}</span>
            </p>
            <p className="flex justify-between text-emerald-700">
              <span>İndirim</span>
              <span>-{formatPara(order.discountAmount)}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900">
              <span>Toplam</span>
              <span>{formatPara(order.totalAmount)}</span>
            </p>
          </div>
        </div>
      </div>

      {(order.shipmentTrackingNo || order.shipmentCarrier) && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <Clock className="h-4 w-4" />
            Kargo Bilgileri
          </h2>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-indigo-900">
              <span className="font-medium">Taşıyıcı: </span>
              {order.shipmentCarrier
                ? CARRIER_LABEL[order.shipmentCarrier] || order.shipmentCarrier
                : "—"}
            </p>
            {order.shipmentTrackingNo && (
              <p className="text-indigo-900 tabular-nums">
                <span className="font-medium">Takip No: </span>
                {order.shipmentTrackingNo}
              </p>
            )}
            {order.shippedAt && (
              <p className="text-xs text-indigo-700 tabular-nums">
                Kargoya verildi: {formatTarih(order.shippedAt)}
              </p>
            )}
            {order.shipmentTrackingUrl && (
              <a
                href={order.shipmentTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Kargo Sayfasında Takip Et →
              </a>
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Kalemler ({items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                  Ürün
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                  Adet
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                  Birim
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                  Satır Toplam
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2.5">
                    <Link
                      href={
                        it.productId
                          ? `/${locale}/bayi/katalog/${it.productId}`
                          : "#"
                      }
                      className="text-sm font-medium text-slate-900 hover:text-indigo-700"
                    >
                      {it.productName}
                    </Link>
                    <p className="text-xs text-slate-500">{it.productCode}</p>
                    {it.campaignName && (
                      <p className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                        {it.campaignName}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatPara(it.unitPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatPara(it.totalPrice)}
                    {it.lineDiscount > 0 && (
                      <p className="text-xs text-emerald-700">
                        -{formatPara(it.lineDiscount)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {history.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock className="h-4 w-4" /> Durum Geçmişi
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div>
                  <p className="text-sm text-slate-900">
                    {h.fromStatus && `${STATUS_LABEL[h.fromStatus] || h.fromStatus} → `}
                    <span className="font-medium">
                      {STATUS_LABEL[h.toStatus] || h.toStatus}
                    </span>
                  </p>
                  {h.reason && <p className="text-xs text-slate-500">{h.reason}</p>}
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {formatTarih(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
