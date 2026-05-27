/**
 * Restoran B2C Sipariş Ödeme — Mollie one-off payment wrapper.
 *
 * Mevcut `src/platform/billing/mollie.ts` Pro abonelik için (subscription
 * mandate). Restoran B2C sipariş tek-seferlik ödeme — burada ayrı helper.
 *
 * Akış:
 *   1. /api/r/[slug]/orders → DB'ye rst_b2c_orders INSERT (status: pending_payment)
 *   2. createOrderPayment() → Mollie payment + checkoutUrl döner
 *   3. order.mollie_payment_id + mollie_checkout_url DB'ye yaz
 *   4. Müşteri checkoutUrl'e redirect (iDEAL/kart seç)
 *   5. Mollie webhook → /api/r/mollie-webhook → getOrderPayment + status sync
 *   6. status='paid' → order.payment_status='paid' + status='received'
 *   7. Müşteri Mollie'den redirectUrl'e döner: /r/{slug}/siparis/{orderId}
 *
 * Auth: MOLLIE_API_KEY env (test_*** veya live_***). Platform-tek-hesap MVP —
 * tüm restoran ödemeleri UPU Mollie hesabına gelir. V2: Mollie Connect ile
 * her restoran kendi hesabına alır.
 */

const MOLLIE_BASE = "https://api.mollie.com/v2";

function getApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY env değişkeni tanımlı değil.");
  return key;
}

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://restoranai.upudev.nl";
}

interface MolliePayload {
  [key: string]: unknown;
}

async function mollieFetch<T>(path: string, init?: { method?: string; body?: MolliePayload }): Promise<T> {
  const r = await fetch(`${MOLLIE_BASE}${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    throw new Error(`Mollie ${r.status}: ${text}`);
  }
  return json as T;
}

export type MolliePaymentStatus =
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "canceled"
  | "expired"
  | "failed";

export interface MollieOrderPayment {
  id: string;
  status: MolliePaymentStatus;
  amount: { currency: string; value: string };
  description: string;
  metadata?: Record<string, string> | null;
  method?: string | null;     // "ideal" | "creditcard" | null (müşteri seçer)
  _links?: { checkout?: { href: string }; [k: string]: unknown };
  paidAt?: string;
  expiresAt?: string;
  failedAt?: string;
  canceledAt?: string;
}

export interface CreateOrderPaymentArgs {
  orderId: string;             // rst_b2c_orders.id (DB UUID)
  orderNumber: string;          // "#12345" — müşteriye görünen
  restaurantSlug: string;       // "lokanta-akdeniz" — redirect için
  amountEur: number;            // toplam tutar (EUR)
  description: string;          // "Lokanta Akdeniz — Sipariş #12345"
  customerEmail?: string;
  method?: "ideal" | "creditcard";  // null/undefined → Mollie hosted seçim ekranı
}

/**
 * Tek-seferlik sipariş ödemesi — Mollie payment oluştur, checkoutUrl döndür.
 * sequenceType='oneoff' (subscription değil).
 */
export async function createOrderPayment(args: CreateOrderPaymentArgs): Promise<MollieOrderPayment> {
  const body: MolliePayload = {
    amount: { currency: "EUR", value: args.amountEur.toFixed(2) },
    description: args.description,
    sequenceType: "oneoff",
    redirectUrl: `${getAppUrl()}/tr/r/${args.restaurantSlug}/siparis/${args.orderId}`,
    webhookUrl: `${getAppUrl()}/api/r/mollie-webhook`,
    metadata: {
      order_id: args.orderId,
      order_number: args.orderNumber,
      restaurant_slug: args.restaurantSlug,
    },
  };

  // Müşteri ödeme yöntemi seçmişse (iDEAL/kart) önceden filtrele
  if (args.method) body.method = args.method;
  if (args.customerEmail) body.billingEmail = args.customerEmail;

  return mollieFetch<MollieOrderPayment>("/payments", { method: "POST", body });
}

/**
 * Webhook'tan veya client'tan payment durumu okumak için.
 * Mollie webhook signature yok — webhook callback'inde payment ID gelir,
 * bu ID'yi Mollie'den fetch ederek doğrulanır (idempotent).
 */
export async function getOrderPayment(paymentId: string): Promise<MollieOrderPayment> {
  return mollieFetch<MollieOrderPayment>(`/payments/${paymentId}`);
}

/**
 * Mollie payment status → DB b2c_orders.payment_status mapping.
 * 'open', 'pending', 'authorized' → 'pending' (henüz para gelmedi)
 * 'paid' → 'paid'
 * 'canceled', 'expired' → 'expired'
 * 'failed' → 'failed'
 */
export function molliePaymentStatusToDb(
  status: MolliePaymentStatus,
): "pending" | "paid" | "failed" | "refunded" | "expired" {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
    case "expired":
      return "expired";
    case "open":
    case "pending":
    case "authorized":
    default:
      return "pending";
  }
}

/**
 * Helper: Mollie payment status → order.status update.
 * 'paid' → 'received' (restoran panelinde "yeni sipariş" olarak görünür)
 * Diğer hata durumlarında order.status değişmez (pending_payment kalır,
 * cleanup cron tarafından expire edilir).
 */
export function shouldOrderBeReceived(status: MolliePaymentStatus): boolean {
  return status === "paid";
}
