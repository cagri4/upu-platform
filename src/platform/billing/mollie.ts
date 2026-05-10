/**
 * Mollie API wrapper — UPU emlak Pro abonelik akışı için minimum yüzey:
 * - Customer create
 * - First payment (mandate kaydı için ödeme — sequenceType='first')
 * - Subscription create (recurring — first payment paid olunca)
 * - Subscription cancel
 * - Payment fetch (webhook'ta status okumak için)
 *
 * Mollie 2-step subscription mimarisi:
 * 1. Customer oluştur
 * 2. First payment (€19 veya €190) — kullanıcı Mollie checkout'unda kart bilgisi verir
 * 3. Webhook'ta payment status='paid' olunca → Subscription create
 *    (otomatik recurring, mandate o ödemeden alınır)
 *
 * Ref: https://docs.mollie.com/reference/v2/customers-api / subscriptions-api
 */

const MOLLIE_BASE = "https://api.mollie.com/v2";

function getApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY env değişkeni tanımlı değil.");
  return key;
}

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
}

export type Plan = "pro_monthly" | "pro_yearly";

export const PLAN_AMOUNT: Record<Plan, string> = {
  pro_monthly: "19.00",
  pro_yearly: "190.00",
};

export const PLAN_INTERVAL: Record<Plan, string> = {
  pro_monthly: "1 month",
  pro_yearly: "12 months",
};

export const PLAN_DESCRIPTION: Record<Plan, string> = {
  pro_monthly: "UPU Pro Aylık",
  pro_yearly: "UPU Pro Yıllık",
};

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

export interface MollieCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export async function createCustomer(args: { email: string; name?: string; userId: string }): Promise<MollieCustomer> {
  return mollieFetch<MollieCustomer>("/customers", {
    method: "POST",
    body: {
      email: args.email,
      name: args.name,
      metadata: { user_id: args.userId },
    },
  });
}

export interface MolliePayment {
  id: string;
  status: "open" | "pending" | "authorized" | "paid" | "canceled" | "expired" | "failed";
  amount: { currency: string; value: string };
  description: string;
  sequenceType?: "oneoff" | "first" | "recurring";
  customerId?: string;
  mandateId?: string | null;
  subscriptionId?: string | null;
  metadata?: Record<string, string> | null;
  _links?: { checkout?: { href: string }; [k: string]: unknown };
}

/**
 * İlk ödeme — mandate kaydı için. Kullanıcı Mollie checkout'unda kart
 * bilgisi verir; başarılı olursa webhook tetiklenir ve `createSubscription`
 * recurring akışı başlatılır.
 */
export async function createFirstPayment(args: {
  customerId: string;
  plan: Plan;
  userId: string;
}): Promise<MolliePayment> {
  return mollieFetch<MolliePayment>("/payments", {
    method: "POST",
    body: {
      amount: { currency: "EUR", value: PLAN_AMOUNT[args.plan] },
      description: PLAN_DESCRIPTION[args.plan],
      sequenceType: "first",
      customerId: args.customerId,
      redirectUrl: `${getAppUrl()}/tr/uyelik?status=success`,
      webhookUrl: `${getAppUrl()}/api/billing/mollie-webhook`,
      metadata: { user_id: args.userId, plan: args.plan },
    },
  });
}

export async function getPayment(paymentId: string): Promise<MolliePayment> {
  return mollieFetch<MolliePayment>(`/payments/${paymentId}`);
}

export interface MollieSubscription {
  id: string;
  customerId: string;
  status: "pending" | "active" | "canceled" | "suspended" | "completed";
  amount: { currency: string; value: string };
  interval: string;
  description: string;
  startDate?: string;
  nextPaymentDate?: string | null;
  metadata?: Record<string, string> | null;
}

export async function createSubscription(args: {
  customerId: string;
  plan: Plan;
  userId: string;
}): Promise<MollieSubscription> {
  return mollieFetch<MollieSubscription>(`/customers/${args.customerId}/subscriptions`, {
    method: "POST",
    body: {
      amount: { currency: "EUR", value: PLAN_AMOUNT[args.plan] },
      interval: PLAN_INTERVAL[args.plan],
      description: PLAN_DESCRIPTION[args.plan],
      webhookUrl: `${getAppUrl()}/api/billing/mollie-webhook`,
      metadata: { user_id: args.userId, plan: args.plan },
    },
  });
}

export async function cancelSubscription(customerId: string, subscriptionId: string): Promise<MollieSubscription> {
  return mollieFetch<MollieSubscription>(
    `/customers/${customerId}/subscriptions/${subscriptionId}`,
    { method: "DELETE" },
  );
}

export async function getSubscription(customerId: string, subscriptionId: string): Promise<MollieSubscription> {
  return mollieFetch<MollieSubscription>(`/customers/${customerId}/subscriptions/${subscriptionId}`);
}
