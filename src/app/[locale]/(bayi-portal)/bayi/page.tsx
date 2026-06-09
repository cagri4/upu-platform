"use client";

/**
 * Bayi Ana Sayfa (Faz 2 Sprint A).
 *
 * Ayşe Hanım girince ilk gördüğü:
 *   1) Kampanya banner şeridi (slider) — kendisine uygun aktif olanlar
 *   2) Sık siparişlerin kısa yolları (grid)
 *   3) Son siparişler (özet kartlar)
 *   4) Favori ürünler (Sprint B'de favori toggle eklenir)
 *
 * V3 dilinde indigo accent.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Megaphone,
  Package,
  Repeat,
  ArrowRight,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface CampaignLite {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  startDate: string;
  endDate: string;
  couponCode: string | null;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface ProductLite {
  id: string;
  code: string;
  name: string;
  basePrice: number;
  unit: string;
  imageUrl: string | null;
  stockQuantity: number;
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

const TYPE_LABEL: Record<string, string> = {
  percent_discount: "% İndirim",
  volume_discount: "Al-X-öde-Y",
  coupon: "Kupon",
  gift_product: "Hediye",
  free_shipping: "Ücretsiz Kargo",
};

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTarihKisa = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });

export default function BayiAnaSayfaPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [frequent, setFrequent] = useState<ProductLite[]>([]);
  const [hasDealer, setHasDealer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bayi/home", { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setCampaigns(d.campaigns || []);
      setRecentOrders(d.recentOrders || []);
      setFrequent(d.frequentProducts || []);
      setHasDealer(!!d.dealer);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hoşgeldin başlığı */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ana Sayfa</h1>
          <p className="mt-1 text-sm text-slate-600">
            Kampanyaları gör, sık sipariş ürünlerini tek tıkla sepete ekle.
          </p>
        </div>
        <Link
          href={`/${locale}/bayi/katalog`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <ShoppingBag className="h-4 w-4" />
          Kataloğa Git
        </Link>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!hasDealer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            Henüz dağıtıcı tarafında bir bayi kaydın yok.
          </p>
          <p className="mt-1 text-amber-800">
            Dağıtıcın seni sisteme eklediğinde otomatik bağlanacaksın. Şimdilik
            katalogu inceleyebilirsin.
          </p>
        </div>
      )}

      {/* 1) Kampanya banner şeridi */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Megaphone className="h-4 w-4 text-indigo-600" />
            Aktif Kampanyalar
          </h2>
          <span className="text-xs text-slate-500">{campaigns.length} kampanya</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Şu an sana özel aktif kampanya yok.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white">
                    {c.type ? TYPE_LABEL[c.type] : "Kampanya"}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {formatTarihKisa(c.endDate)} bitiyor
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">
                  {c.title}
                </h3>
                {c.description && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {c.description}
                  </p>
                )}
                {c.couponCode && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                    Kod: <code className="font-mono">{c.couponCode}</code>
                  </p>
                )}
                <Link
                  href={`/${locale}/bayi/katalog`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                >
                  Kataloğa git <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2) Sık siparişler */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Repeat className="h-4 w-4 text-indigo-600" />
            Sık Siparişlerin
          </h2>
          <Link
            href={`/${locale}/bayi/katalog`}
            className="text-xs font-medium text-indigo-700 hover:underline"
          >
            Tümünü gör →
          </Link>
        </div>
        {frequent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Henüz sipariş geçmişin yok — kataloğa girip ilk siparişini ver.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {frequent.map((p) => (
              <Link
                key={p.id}
                href={`/${locale}/bayi/katalog/${p.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-24 items-center justify-center rounded-lg bg-slate-50">
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">{p.code}</p>
                  <p className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-indigo-700">
                    {p.name}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatPara(p.basePrice)}
                  </span>
                  {p.stockQuantity > 0 ? (
                    <StatusBadge tone="success">Stokta</StatusBadge>
                  ) : (
                    <StatusBadge tone="danger">Tükendi</StatusBadge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 3) Son siparişler */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            Son Siparişlerin
          </h2>
          <Link
            href={`/${locale}/bayi/siparislerim`}
            className="text-xs font-medium text-indigo-700 hover:underline"
          >
            Tümü →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Henüz sipariş yok.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/${locale}/bayi/siparislerim/${o.id}`}
                    className="text-sm font-medium tabular-nums text-slate-900 hover:text-indigo-700"
                  >
                    #{o.orderNumber}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatTarih(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone={STATUS_TONE[o.status] || "neutral"}>
                    {STATUS_LABEL[o.status] || o.status}
                  </StatusBadge>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatPara(o.totalAmount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
