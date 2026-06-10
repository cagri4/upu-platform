"use client";

/**
 * Kargo takip sayfası — /tr/bayi/takip/[no].
 *
 * Audit 2026-06-10 P0 #5 fix'i: mock takip no'ları doğrudan gerçek kargo
 * sitesine yönlendirilmiyor (sonsuz 404 tuzağı). Bu iç sayfa takip no +
 * taşıyıcıyı gösterir; canlı kargo sözleşmesi yapılınca gerçek durum
 * carrier API'sinden buraya akacak.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Truck, ArrowLeft, ExternalLink, Info } from "lucide-react";

interface Tracking {
  trackingNo: string;
  carrier: string | null;
  carrierLabel: string | null;
  externalUrl: string | null;
  shipmentStatus: string | null;
  shippedAt: string | null;
  orderId: string;
  orderNumber: string;
  orderStatus: string | null;
  mocked: boolean;
}

function formatTarih(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KargoTakipPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const no = typeof params?.no === "string" ? params.no : "";

  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bayi/takip/${encodeURIComponent(no)}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Takip kaydı yüklenemedi.");
      } else {
        setTracking(d.tracking);
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [no]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/${locale}/bayi/siparislerim`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Siparişlerim
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error || "Takip kaydı bulunamadı."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/${locale}/bayi/siparislerim/${tracking.orderId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Sipariş #{tracking.orderNumber}
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Kargo Takip</h1>
            <p className="text-sm text-slate-500">
              {tracking.carrierLabel || "Taşıyıcı bilinmiyor"}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <dt className="font-medium text-slate-500">Takip No</dt>
            <dd className="font-semibold tabular-nums text-slate-900" data-testid="takip-no">
              {tracking.trackingNo}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <dt className="font-medium text-slate-500">Durum</dt>
            <dd className="font-medium text-slate-900">
              {tracking.shipmentStatus === "delivered"
                ? "Teslim edildi"
                : tracking.orderStatus === "shipped"
                  ? "Yolda"
                  : tracking.shipmentStatus || "Kargoya verildi"}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <dt className="font-medium text-slate-500">Kargoya Verilme</dt>
            <dd className="tabular-nums text-slate-900">{formatTarih(tracking.shippedAt)}</dd>
          </div>
        </dl>

        {tracking.mocked ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Bu kargo takip numarası test (mock) verisidir; canlı kargo
              sözleşmesi aktive edildiğinde gerçek taşıma durumu bu sayfada
              görünecek. Kargo firmasının sitesinde bu numara sorgulanamaz.
            </p>
          </div>
        ) : (
          tracking.externalUrl && (
            <a
              href={tracking.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {tracking.carrierLabel} sitesinde takip et
              <ExternalLink className="h-4 w-4" />
            </a>
          )
        )}
      </section>
    </div>
  );
}
