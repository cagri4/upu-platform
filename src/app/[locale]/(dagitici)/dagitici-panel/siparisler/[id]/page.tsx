"use client";

/**
 * Sipariş detay — bayi bilgi + kalemler + kampanya + onay/red butonları.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  couponCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Dealer {
  id: string;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  segment: string | null;
  region: string | null;
}

interface OrderItem {
  id: string;
  productId: string | null;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  totalPrice: number;
  campaignId: string | null;
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
  delivered: "Teslim",
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

export default function SiparisDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dagitici/siparisler/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setOrder(d.order);
      setDealer(d.dealer);
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

  async function approve() {
    setActing(true);
    const res = await fetch(`/api/dagitici/siparisler/${id}/onayla`, {
      method: "POST",
      credentials: "same-origin",
    });
    setActing(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Onaylanamadı.");
      return;
    }
    load();
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    setActing(true);
    const res = await fetch(`/api/dagitici/siparisler/${id}/reddet`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setActing(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Reddedilemedi.");
      return;
    }
    setRejectOpen(false);
    setRejectReason("");
    load();
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

  const canAct = order.status === "pending";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/dagitici-panel/siparisler`}
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
        {canAct && (
          <div className="flex gap-2">
            <button
              onClick={() => setRejectOpen(true)}
              disabled={acting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <XCircle className="h-4 w-4" />
              Reddet
            </button>
            <button
              onClick={approve}
              disabled={acting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {acting ? "İşleniyor…" : "Onayla"}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {dealer && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bayi
            </p>
            <p className="mt-2 text-base font-medium text-slate-900">{dealer.name}</p>
            <p className="text-sm text-slate-600">{dealer.contactName || "—"}</p>
            <p className="mt-2 text-sm text-slate-700">{dealer.phone}</p>
            {dealer.email && <p className="text-xs text-slate-500">{dealer.email}</p>}
            {(dealer.segment || dealer.region) && (
              <p className="mt-2 text-xs text-slate-500">
                {dealer.segment && `Segment ${dealer.segment}`}
                {dealer.region && ` · ${dealer.region}`}
              </p>
            )}
            <Link
              href={`/${locale}/dagitici-panel/bayiler/${dealer.id}`}
              className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline"
            >
              Bayi sayfasına git →
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sipariş
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
            <p className="mt-2 text-xs text-slate-600">
              Kupon: <code>{order.couponCode}</code>
            </p>
          )}
          {order.notes && (
            <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              {order.notes}
            </p>
          )}
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Kalemler ({items.length})
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Kalem yok.</p>
        ) : (
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
                    İskonto
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
                      <p className="text-sm font-medium text-slate-900">
                        {it.productName}
                      </p>
                      <p className="text-xs text-slate-500">{it.productCode}</p>
                      {it.campaignName && (
                        <p className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          Kampanya: {it.campaignName}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatPara(it.unitPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {it.lineDiscount > 0 ? `-${formatPara(it.lineDiscount)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {formatPara(it.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock className="h-4 w-4" /> Durum Geçmişi
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 py-2">
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

      {rejectOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Siparişi Reddet
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Bayiye gönderilecek sebep notu (zorunlu):
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Stok kalmadı / kredi limiti aşıldı / vb."
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason("");
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={reject}
                disabled={acting || !rejectReason.trim()}
                className="h-9 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {acting ? "Reddediliyor…" : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
