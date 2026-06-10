"use client";

/**
 * Bayi Checkout — tek-sayfa (Faz 2 Sprint C).
 *
 * Adım yok — tüm bilgiler tek ekranda. Sol: teslimat + ödeme yöntemi seçim.
 * Sağ: özet (kampanya hesabı + final toplam). Sipariş ver → onay.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Package,
  CheckCircle2,
  ShoppingCart,
  Truck,
  Sparkles,
} from "lucide-react";
import { getCart, clearCart, type CartLine } from "@/lib/buyer-cart";

interface ResolveResult {
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  freeShipping: boolean;
  appliedCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    discountAmount: number;
    note: string;
  }>;
  gifts: Array<{ productId: string; quantity: number }>;
}

interface MeResponse {
  dealer: {
    id: string;
    name: string;
    segment: string | null;
    region: string | null;
  } | null;
}

const PAYMENT_OPTIONS = [
  {
    id: "card",
    label: "Kredi Kartı",
    desc: "iyzico ile güvenli ödeme (mock — Faz 3'te canlı)",
    icon: CreditCard,
  },
  {
    id: "transfer",
    label: "Havale / EFT",
    desc: "Sipariş onayı sonrası IBAN bilgileri gönderilir",
    icon: Banknote,
  },
  {
    id: "open_account",
    label: "Açık Hesap",
    desc: "Vade tanımlıysa cariye yazılır",
    icon: Package,
  },
] as const;
type PaymentId = (typeof PAYMENT_OPTIONS)[number]["id"];

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

export default function BayiOdemePage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [dealer, setDealer] = useState<MeResponse["dealer"]>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentId>("transfer");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  useEffect(() => {
    setLines(getCart().lines);
    if (typeof window !== "undefined") {
      const coupon = sessionStorage.getItem("upu-cart-coupon") || "";
      setCouponCode(coupon);
    }
  }, []);

  useEffect(() => {
    fetch("/api/bayi/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.dealer) setDealer(d.dealer);
      })
      .catch(() => {});
  }, []);

  // Kampanya çöz
  const resolveCampaigns = useCallback(async () => {
    if (!dealer || lines.length === 0) {
      setResolveResult(null);
      return;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/dagitici/kampanya-resolve", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealer_id: dealer.id,
          cart: lines.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
            unit_price: l.listUnitPrice,
          })),
          coupon_code: couponCode || null,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setResolveResult(d);
      } else {
        // 403 olursa: kampanya-resolve dağıtıcı endpoint'i — bayi
        // tarafından çağrılamayabilir. Fallback: yalnızca subtotal.
        const subtotal = lines.reduce(
          (s, l) => s + l.listUnitPrice * l.quantity,
          0,
        );
        setResolveResult({
          subtotal,
          totalDiscount: 0,
          finalTotal: subtotal,
          freeShipping: false,
          appliedCampaigns: [],
          gifts: [],
        });
      }
    } catch {
      const subtotal = lines.reduce(
        (s, l) => s + l.listUnitPrice * l.quantity,
        0,
      );
      setResolveResult({
        subtotal,
        totalDiscount: 0,
        finalTotal: subtotal,
        freeShipping: false,
        appliedCampaigns: [],
        gifts: [],
      });
    } finally {
      setResolving(false);
    }
  }, [dealer, lines, couponCode]);

  useEffect(() => {
    resolveCampaigns();
  }, [resolveCampaigns]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.listUnitPrice * l.quantity, 0),
    [lines],
  );

  async function placeOrder() {
    if (lines.length === 0) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/bayi/siparis-olustur", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
          })),
          payment_method: paymentMethod,
          delivery_address: deliveryAddress,
          notes,
          coupon_code: couponCode || null,
          clear_cart: true,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Sipariş kaydedilemedi.");
        return;
      }
      clearCart();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("upu-cart-coupon");
      }

      // Faz 3 Sprint G: kart ödemesi → iyzico checkout başlat ve redirect
      if (paymentMethod === "card") {
        const iyzRes = await fetch("/api/bayi/iyzico/start", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: d.orderId }),
        });
        const iyzData = await iyzRes.json();
        if (!iyzRes.ok || !iyzData.success || !iyzData.paymentPageUrl) {
          alert(
            iyzData.error ||
              "Kart ödeme başlatılamadı. Sipariş kaydedildi, siparişlerinden tekrar dene veya farklı ödeme yöntemi seç.",
          );
          setSuccess({ orderId: d.orderId, orderNumber: d.orderNumber });
          return;
        }
        // Mock URL ise direkt callback'e GET (sandbox/canlı key yokken UI test)
        window.location.href = iyzData.paymentPageUrl;
        return;
      }

      setSuccess({ orderId: d.orderId, orderNumber: d.orderNumber });
    } finally {
      setPlacing(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Siparişin alındı!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sipariş numaran:{" "}
          <span className="font-mono font-semibold tabular-nums text-slate-900">
            #{success.orderNumber}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Dağıtıcı onayı sonrası WhatsApp'tan bilgi alacaksın.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href={`/${locale}/bayi/siparislerim/${success.orderId}`}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Siparişi Görüntüle
          </Link>
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

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">
          Sepetin boş. Önce katalogdan ürün ekle.
        </p>
        <Link
          href={`/${locale}/bayi/katalog`}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Kataloğa Git
        </Link>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Bayi hesabın henüz aktif değil.</p>
        <p className="mt-1">
          Dağıtıcına seni sisteme eklemesini iste, sonra siparişini ver.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/bayi/sepet`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Ödeme</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Sol — Teslimat + Ödeme */}
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Truck className="h-4 w-4 text-indigo-600" />
              Teslimat
            </h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">{dealer.name}</p>
                {dealer.region && (
                  <p className="text-xs text-slate-500">{dealer.region}</p>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700">
                  Ek teslimat notu / adres (opsiyonel)
                </span>
                <textarea
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Sabah 10'a kadar teslim olsun, kapıcı Mustafa Bey'e bırakın, vb."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              Ödeme Yöntemi
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = paymentMethod === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${selected ? "text-indigo-600" : "text-slate-400"}`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        selected ? "text-indigo-900" : "text-slate-900"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-xs text-slate-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Ek Not</h2>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sipariş ile ilgili özel bir notun varsa..."
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </section>
        </div>

        {/* Sağ — Özet */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Özet</h2>
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-slate-700">
                    {l.productName}
                    <span className="ml-1 text-xs text-slate-500 tabular-nums">
                      × {l.quantity}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums text-slate-900">
                    {formatPara(l.listUnitPrice * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm tabular-nums">
              <p className="flex justify-between text-slate-600">
                <span>Ara toplam</span>
                <span>{formatPara(subtotal)}</span>
              </p>
              {resolveResult && resolveResult.totalDiscount > 0 && (
                <p className="flex justify-between text-emerald-700">
                  <span>Kampanya indirimi</span>
                  <span>-{formatPara(resolveResult.totalDiscount)}</span>
                </p>
              )}
              {resolveResult?.freeShipping && (
                <p className="flex justify-between text-emerald-700">
                  <span>Kargo</span>
                  <span>Bedava</span>
                </p>
              )}
              <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                <span>Toplam</span>
                <span>
                  {resolveResult ? formatPara(resolveResult.finalTotal) : formatPara(subtotal)}
                </span>
              </p>
            </div>
            {resolveResult && resolveResult.appliedCampaigns.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                {resolveResult.appliedCampaigns.map((c, i) => (
                  <p key={i} className="flex items-start gap-1 text-xs text-emerald-700">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      <strong>{c.campaignName}</strong>: {c.note}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={placeOrder}
              disabled={placing || resolving}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {placing ? "Sipariş veriliyor…" : "Siparişi Tamamla"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              "Siparişi Tamamla" ile sipariş dağıtıcıya onaya düşer.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
