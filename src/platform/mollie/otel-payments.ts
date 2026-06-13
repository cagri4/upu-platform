/**
 * Otel Rezervasyon Ödeme — Mollie one-off payment wrapper (Faz 4)
 *
 * Restoran B2C ile aynı pattern. Platform-tek-hesap MVP: tüm otel
 * ödemeleri UPU Mollie hesabına gelir. V2: Mollie Connect ile her otel
 * kendi hesabına alır.
 */

const MOLLIE_BASE = "https://api.mollie.com/v2";

function getApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY env değişkeni tanımlı değil.");
  return key;
}

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hotelai.upudev.nl";
}

interface MolliePayload { [key: string]: unknown }

async function mollieFetch<T>(path: string, init?: { method?: string; body?: MolliePayload }): Promise<T> {
  const r = await fetch(`${MOLLIE_BASE}${path}`, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) throw new Error(`Mollie ${r.status}: ${text}`);
  return json as T;
}

export type MolliePaymentStatus =
  | "open" | "pending" | "authorized" | "paid"
  | "canceled" | "expired" | "failed";

export interface MollieOtelPayment {
  id: string;
  status: MolliePaymentStatus;
  amount: { currency: string; value: string };
  description: string;
  metadata?: Record<string, string> | null;
  _links?: { checkout?: { href: string }; [k: string]: unknown };
  paidAt?: string;
}

export interface CreateOtelPaymentArgs {
  paymentId: string;            // otel_payments.id (DB UUID)
  reservationId: string;
  slug: string;                 // hotel slug (redirect)
  amount: number;               // TRY
  description: string;
  guestEmail?: string;
}

export async function createOtelPayment(args: CreateOtelPaymentArgs): Promise<MollieOtelPayment> {
  const appUrl = getAppUrl();
  const valueStr = args.amount.toFixed(2);

  const payload: MolliePayload = {
    amount: { currency: "TRY", value: valueStr },
    description: args.description,
    redirectUrl: `${appUrl}/tr/o/${args.slug}/odeme/${args.paymentId}`,
    webhookUrl: `${appUrl}/api/billing/otel-mollie-webhook`,
    metadata: {
      payment_id: args.paymentId,
      reservation_id: args.reservationId,
    },
  };
  if (args.guestEmail) {
    (payload as any).billingEmail = args.guestEmail;
  }

  return mollieFetch<MollieOtelPayment>("/payments", { method: "POST", body: payload });
}

export async function getOtelPayment(mollieId: string): Promise<MollieOtelPayment> {
  return mollieFetch<MollieOtelPayment>(`/payments/${mollieId}`);
}

export async function refundOtelPayment(mollieId: string, amount: number): Promise<{ id: string; status: string }> {
  const valueStr = amount.toFixed(2);
  return mollieFetch<{ id: string; status: string }>(`/payments/${mollieId}/refunds`, {
    method: "POST",
    body: { amount: { currency: "TRY", value: valueStr } },
  });
}
