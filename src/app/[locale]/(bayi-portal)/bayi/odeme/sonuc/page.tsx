"use client";

/**
 * Ödeme sonuç sayfası — iyzico CF callback'inden gelen redirect target.
 *
 * Query: status (success|failed|error) + order_id + reason
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function OdemeSonucPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [status, setStatus] = useState<"success" | "failed" | "error">("error");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("status") as "success" | "failed" | "error" | null;
    if (s === "success" || s === "failed" || s === "error") setStatus(s);
    setOrderId(searchParams.get("order_id"));
    setReason(searchParams.get("reason"));
  }, [searchParams]);

  if (status === "success") {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Ödemen alındı!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Siparişin otomatik onaylandı, hazırlığa geçirildi. WhatsApp'tan
          bilgi alacaksın.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {orderId && (
            <Link
              href={`/${locale}/bayi/siparislerim/${orderId}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Siparişi Görüntüle
            </Link>
          )}
          <Link
            href={`/${locale}/bayi/katalog`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Yeni Sipariş
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <XCircle className="mx-auto h-16 w-16 text-rose-500" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Ödeme başarısız
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {reason
            ? decodeURIComponent(reason)
            : "Banka veya kart sistemleri ödemeyi reddetti."}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Siparişin sepetinde — başka kart deneyebilir veya farklı ödeme
          yöntemi seçebilirsin.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => router.push(`/${locale}/bayi/odeme`)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Tekrar Dene
          </button>
          <Link
            href={`/${locale}/bayi/siparislerim`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Siparişlerim
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <AlertCircle className="mx-auto h-16 w-16 text-amber-500" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        Ödeme durumu belirsiz
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {reason ? decodeURIComponent(reason) : "Bağlantı sırasında bir sorun oldu."}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Siparişlerini kontrol et — eğer ödeme alındıysa görünür.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href={`/${locale}/bayi/siparislerim`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Siparişlerim
        </Link>
        <Link
          href={`/${locale}/bayi/katalog`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Kataloğa Git
        </Link>
      </div>
    </div>
  );
}
