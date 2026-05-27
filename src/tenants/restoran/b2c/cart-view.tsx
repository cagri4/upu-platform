"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  UtensilsCrossed,
  Truck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useCart } from "./cart-context";
import { cartSubtotal, lineTotal } from "./cart-types";
import { useTableContext } from "./use-table-context";

interface DeliveryZone {
  name: string;
  postal_codes?: string[];
  min_order?: number;
  fee?: number;
}

type DeliveryType = "delivery" | "pickup" | "dine_in";
type PaymentMethod = "ideal" | "card" | "cash_on_delivery" | "card_on_delivery" | "dine_in_later";

function fmtEur(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function CartView({
  locale,
  slug,
  brandName,
  primaryColor,
  acceptsOnlinePayment,
  acceptsCashOnDelivery,
  acceptsDineIn,
  deliveryZones,
  estimatedPrepMinutes,
}: {
  locale: string;
  slug: string;
  brandName: string;
  primaryColor: string;
  acceptsOnlinePayment: boolean;
  acceptsCashOnDelivery: boolean;
  acceptsDineIn: boolean;
  deliveryZones: DeliveryZone[];
  estimatedPrepMinutes: number;
}) {
  const router = useRouter();
  const { cart, hydrated, setQuantity, removeItem, setNotes, clear } = useCart();
  const { tableContext } = useTableContext(slug);

  // Delivery type — masa context varsa dine_in zorla, yoksa default 'delivery'
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    tableContext ? "dine_in" : "delivery",
  );

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Address (only for delivery)
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNo, setAddrNo] = useState("");
  const [addrApartment, setAddrApartment] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrNote, setAddrNote] = useState("");

  // Payment — masa context varsa dine_in_later default, yoksa iDEAL veya cash
  const defaultPayment: PaymentMethod = tableContext
    ? "dine_in_later"
    : acceptsOnlinePayment
      ? "ideal"
      : "cash_on_delivery";
  const [payment, setPayment] = useState<PaymentMethod>(defaultPayment);

  // Order note
  const [orderNote, setOrderNote] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => cartSubtotal(cart.items), [cart.items]);

  // Delivery fee (basit: ilk zone fee, gerçek post-code match V2)
  const selectedZone = deliveryZones[0] || null;
  const deliveryFee = deliveryType === "delivery" && selectedZone?.fee ? selectedZone.fee : 0;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  const minOrderOk =
    deliveryType !== "delivery" || !selectedZone?.min_order || subtotal >= selectedZone.min_order;

  function validate(): string | null {
    if (cart.items.length === 0) return "Sepetiniz boş.";
    if (customerName.trim().length < 2) return "Ad soyad gerekli.";
    if (!/^[+\d\s()-]{7,}$/.test(customerPhone.trim())) return "Geçerli bir telefon girin.";
    if (customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
      return "Geçerli bir e-posta girin.";
    }
    if (deliveryType === "delivery") {
      if (addrStreet.trim().length < 2) return "Sokak/cadde gerekli.";
      if (addrNo.trim().length < 1) return "Numara gerekli.";
      if (!/^\d{4}\s*[A-Z]{2}$/i.test(addrPostal.trim().replace(/\s/g, " "))) {
        return "Geçerli posta kodu girin (örn 3011 AA).";
      }
      if (addrCity.trim().length < 2) return "Şehir gerekli.";
    }
    if (!minOrderOk) {
      return `Eve teslimat için minimum sipariş ${fmtEur(selectedZone!.min_order!)}.`;
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload = {
      items: cart.items.map((i) => ({
        menu_item_id: i.menuItemId,
        name: i.name,
        variant: i.variant ? { id: i.variant.id, name: i.variant.name, price_diff: i.variant.priceDiff } : null,
        addons: i.addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        quantity: i.quantity,
        unit_price: i.basePrice + (i.variant?.priceDiff || 0) + i.addons.reduce((s, a) => s + a.price, 0),
        total: lineTotal(i),
        notes: i.notes,
      })),
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      delivery_type: deliveryType,
      table_qr_token: tableContext?.qrToken || null,
      delivery_address:
        deliveryType === "delivery"
          ? {
              street: addrStreet.trim(),
              no: addrNo.trim(),
              apartment: addrApartment.trim() || null,
              postal: addrPostal.trim().toUpperCase(),
              city: addrCity.trim(),
              note: addrNote.trim() || null,
            }
          : null,
      payment_method: payment,
      notes: orderNote.trim() || null,
      subtotal,
      delivery_fee: deliveryFee,
      total,
    };

    try {
      const res = await fetch(`/api/r/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        setError(json.error || "Sipariş oluşturulamadı.");
        return;
      }

      // Mollie ödeme varsa redirect
      if (json.checkoutUrl) {
        clear();
        window.location.href = json.checkoutUrl;
        return;
      }

      // Mollie yoksa direkt başarı sayfasına git
      clear();
      router.push(`/${locale}/r/${slug}/siparis/${json.orderId}`);
    } catch {
      setSubmitting(false);
      setError("Bağlantı hatası, tekrar deneyin.");
    }
  }

  if (hydrated && cart.items.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <header className="flex items-center gap-3 mb-8">
          <Link
            href={`/${locale}/r/${slug}/menu`}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            aria-label="Menüye dön"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
          </Link>
          <div className="flex-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">{brandName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Sepetim</div>
          </div>
        </header>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-10 text-center">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Sepetiniz boş
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Menüden ürün ekleyerek sipariş vermeye başlayabilirsiniz.
          </p>
          <Link
            href={`/${locale}/r/${slug}/menu`}
            className="inline-flex items-center text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-95 transition"
            style={{ backgroundColor: primaryColor }}
          >
            Menüyü aç
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/70 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/${locale}/r/${slug}/menu`}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          aria-label="Menüye dön"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{brandName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Sepetim</div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        {/* Cart items */}
        <section className="space-y-2">
          {cart.items.map((item) => {
            const unit =
              item.basePrice + (item.variant?.priceDiff || 0) + item.addons.reduce((s, a) => s + a.price, 0);
            return (
              <div
                key={item.key}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-3 flex gap-3"
              >
                {item.imageUrl ? (
                  <div
                    className="w-16 h-16 flex-shrink-0 rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${item.imageUrl})` }}
                  />
                ) : (
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <UtensilsCrossed className="w-6 h-6 text-slate-300 dark:text-slate-700" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {item.name}
                      {item.variant && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal"> · {item.variant.name}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="text-slate-400 hover:text-rose-600 transition flex-shrink-0"
                      aria-label="Çıkar"
                    >
                      <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                  </div>
                  {item.addons.length > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      + {item.addons.map((a) => a.name).join(", ")}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                      “{item.notes}”
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
                        aria-label="Azalt"
                      >
                        <Minus className="w-3.5 h-3.5" strokeWidth={2.4} />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
                        aria-label="Arttır"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                      </button>
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {fmtEur(unit * item.quantity)}
                    </div>
                  </div>
                  <NoteInput
                    initial={item.notes || ""}
                    onSave={(v) => setNotes(item.key, v.trim() || null)}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* Müşteri bilgileri */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">İletişim</h2>
          <div className="space-y-3">
            <Input label="Ad soyad" value={customerName} onChange={setCustomerName} placeholder="Ahmet Yılmaz" />
            <Input label="Telefon" value={customerPhone} onChange={setCustomerPhone} placeholder="+31 6 12345678" type="tel" />
            <Input label="E-posta (opsiyonel)" value={customerEmail} onChange={setCustomerEmail} placeholder="ornek@mail.com" type="email" />
          </div>
        </section>

        {/* Teslimat tipi — QR'dan geldiyse masa zorunlu, gizli */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {tableContext ? "Masaya servis" : "Teslimat"}
          </h2>
          {tableContext ? (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <Store className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Masa {tableContext.tableLabel}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Siparişiniz masanıza getirilir. Ödeme yemekten sonra garsondan.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ChoiceRadio
                checked={deliveryType === "delivery"}
                onChange={() => setDeliveryType("delivery")}
                primaryColor={primaryColor}
                icon={<Truck className="w-4 h-4" strokeWidth={2.2} />}
                label="Eve teslimat"
                hint={
                  selectedZone
                    ? `${selectedZone.name}${selectedZone.min_order ? ` · min ${fmtEur(selectedZone.min_order, { decimals: 0 })}` : ""}${selectedZone.fee != null ? (selectedZone.fee === 0 ? " · ücretsiz" : ` · ${fmtEur(selectedZone.fee)}`) : ""}`
                    : `~${estimatedPrepMinutes} dk`
                }
              />
              <ChoiceRadio
                checked={deliveryType === "pickup"}
                onChange={() => setDeliveryType("pickup")}
                primaryColor={primaryColor}
                icon={<ShoppingBag className="w-4 h-4" strokeWidth={2.2} />}
                label="Gel-al"
                hint={`Restoran'dan teslim · ~${estimatedPrepMinutes} dk`}
              />
              {acceptsDineIn && (
                <ChoiceRadio
                  checked={deliveryType === "dine_in"}
                  onChange={() => setDeliveryType("dine_in")}
                  primaryColor={primaryColor}
                  icon={<Store className="w-4 h-4" strokeWidth={2.2} />}
                  label="Masada (QR ile geldiyseniz)"
                  hint="Sipariş masaya gelir, ödeme garsondan"
                />
              )}
            </div>
          )}

          {deliveryType === "delivery" && (
            <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Sokak / cadde" value={addrStreet} onChange={setAddrStreet} placeholder="Coolsingel" />
                <Input label="No" value={addrNo} onChange={setAddrNo} placeholder="12" />
              </div>
              <Input label="Apartman / daire (opsiyonel)" value={addrApartment} onChange={setAddrApartment} placeholder="B" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Posta kodu" value={addrPostal} onChange={setAddrPostal} placeholder="3011 AA" />
                <Input label="Şehir" value={addrCity} onChange={setAddrCity} placeholder="Rotterdam" />
              </div>
              <Input label="Kapı kodu / not (opsiyonel)" value={addrNote} onChange={setAddrNote} placeholder="2. kat" />
            </div>
          )}
        </section>

        {/* Ödeme yöntemi */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Ödeme yöntemi</h2>
          <div className="space-y-2">
            {acceptsOnlinePayment && (
              <>
                <ChoiceRadio
                  checked={payment === "ideal"}
                  onChange={() => setPayment("ideal")}
                  primaryColor={primaryColor}
                  label="iDEAL (Hollanda bankası)"
                  hint="Mobil bankacılık ile hızlı ödeme"
                />
                <ChoiceRadio
                  checked={payment === "card"}
                  onChange={() => setPayment("card")}
                  primaryColor={primaryColor}
                  label="Kredi / banka kartı"
                  hint="VISA, Mastercard, Maestro"
                />
              </>
            )}
            {acceptsCashOnDelivery && deliveryType !== "dine_in" && (
              <>
                <ChoiceRadio
                  checked={payment === "cash_on_delivery"}
                  onChange={() => setPayment("cash_on_delivery")}
                  primaryColor={primaryColor}
                  label="Kapıda nakit"
                  hint="Para üstü için belirtin"
                />
                <ChoiceRadio
                  checked={payment === "card_on_delivery"}
                  onChange={() => setPayment("card_on_delivery")}
                  primaryColor={primaryColor}
                  label="Kapıda kart"
                  hint="Kurye PIN cihazı getirir"
                />
              </>
            )}
            {deliveryType === "dine_in" && (
              <ChoiceRadio
                checked={payment === "dine_in_later"}
                onChange={() => setPayment("dine_in_later")}
                primaryColor={primaryColor}
                label="Masada öderim"
                hint="Yemek sonrası garson getirir"
              />
            )}
          </div>
        </section>

        {/* Genel not */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Sipariş notu (opsiyonel)</h2>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Alerji, özel istek vb."
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition"
            rows={2}
            maxLength={300}
          />
        </section>

        {/* Özet */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1.5">
            <span>Ara toplam</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{fmtEur(subtotal)}</span>
          </div>
          {deliveryType === "delivery" && (
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1.5">
              <span>Teslimat</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {deliveryFee === 0 ? "Ücretsiz" : fmtEur(deliveryFee)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-3 border-t border-slate-200/70 dark:border-slate-800 mt-3">
            <span className="text-slate-900 dark:text-slate-100">Toplam</span>
            <span style={{ color: primaryColor }}>{fmtEur(total)}</span>
          </div>
        </section>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !minOrderOk}
          className="w-full text-white font-bold px-5 py-4 rounded-2xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.98] transition flex items-center justify-between"
          style={{ backgroundColor: primaryColor }}
        >
          <span>{submitting ? "Yönlendiriliyor…" : "Siparişi Tamamla"}</span>
          <span>{fmtEur(total)}</span>
        </button>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Devam ederek <Link href={`/${locale}/hizmet-sartlari`} className="underline">hizmet şartları</Link>{" "}
          ve <Link href={`/${locale}/privacy`} className="underline">gizlilik politikası</Link>nı kabul etmiş olursunuz.
        </p>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
      />
    </div>
  );
}

function ChoiceRadio({
  checked,
  onChange,
  primaryColor,
  icon,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  primaryColor: string;
  icon?: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${
        checked
          ? "border-2 bg-slate-50 dark:bg-slate-800"
          : "border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
      style={checked ? { borderColor: primaryColor } : undefined}
    >
      <span
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition ${
          checked ? "" : "border-slate-300 dark:border-slate-600"
        }`}
        style={checked ? { borderColor: primaryColor } : undefined}
      >
        {checked && (
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
          {icon}
          {label}
        </span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function NoteInput({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(initial);

  if (!open && !initial) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mt-1"
      >
        + Not ekle
      </button>
    );
  }
  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      placeholder="örn. acısız"
      className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
      maxLength={120}
      autoFocus={open}
    />
  );
}
