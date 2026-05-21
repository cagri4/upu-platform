/**
 * Bayi tenant Mollie wrapper — agent quota plan tier'larına bağlı.
 *
 * Pricing kaynak: agent_plans tablosu (free/starter/pro/premium).
 * Free 0 EUR/ay (ödemesiz), Starter/Pro/Premium ücretli (EUR).
 *
 * Mollie 2-step subscription flow:
 *   1. Customer create
 *   2. First payment (sequenceType='first') → mandate alır
 *   3. Webhook payment.paid → customer subscription create (recurring)
 *
 * SDK: @mollie/api-client v4. REST wrapper mollie.ts emlak için ayrı kalır.
 */
import createMollieClient, { type MollieClient } from "@mollie/api-client";

let cached: MollieClient | null = null;

export function getMollieClient(): MollieClient {
  if (cached) return cached;
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error("MOLLIE_API_KEY env eksik.");
  cached = createMollieClient({ apiKey });
  return cached;
}

export function getBayiAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL_BAYI || "https://retailai.upudev.nl";
}

/** Webhook URL secret query param ile (Mollie HMAC göndermez — biz koruyoruz). */
export function getBayiWebhookUrl(): string {
  const secret = process.env.MOLLIE_WEBHOOK_SECRET;
  if (!secret) throw new Error("MOLLIE_WEBHOOK_SECRET env eksik.");
  return `${getBayiAppUrl()}/api/billing/webhook?secret=${encodeURIComponent(secret)}`;
}

export function getBayiReturnUrl(status: "success" | "cancel" = "success"): string {
  return `${getBayiAppUrl()}/tr/bayi-billing?return=${status}`;
}

/**
 * agent_plans key'inden subscriptions.plan değeri (text). Free tier ödemesiz —
 * Mollie subscription oluşmaz, sadece DB row.
 */
export function planKeyToSubscriptionPlan(key: string): string {
  // Direct mapping — subscriptions.plan TEXT, agent_plans.key TEXT.
  return key;
}
