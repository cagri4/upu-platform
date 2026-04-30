/**
 * Adapter Resolver — bayi tenant'ı için entegrasyon noktası.
 *
 * Tenant onboarding'de kullanıcı seçtiği yazılımları profile.metadata.
 * enabled_adapters'a kaydeder; runtime'da bu modül o seçimi okuyup
 * ilgili adapter modülünü lazy-load eder.
 *
 * Faz 5+: Yuki/Exact/SnelStart implement edilecek (Chift unified API).
 * Faz 6: Mollie. Faz 8: PostNL.
 *
 * MVP'de stub: implement edilmeyen adapter'lar `AdapterNotReadyError`
 * fırlatır; çağıran kod kullanıcıya "Henüz hazır değil" mesajı gösterir.
 */

import { getServiceClient } from "@/platform/auth/supabase";

// ── Typed adapter contracts (her kategori farklı interface) ─────────────

export interface AccountingAdapter {
  key: string;
  /** Read customer ledger (cari hesap) for a dealer. */
  getDealerBalance: (dealerExternalId: string) => Promise<{ balance: number; currency: string } | null>;
  /** Push a new invoice to the accounting system. */
  pushInvoice: (invoice: {
    dealerExternalId: string;
    invoiceNo: string;
    amount: number;
    currency: string;
    btwRate: number;
    items: Array<{ name: string; quantity: number; unitPrice: number }>;
    dueDate: string;
  }) => Promise<{ externalId: string }>;
  /** Get last N invoices for sync verification. */
  listRecentInvoices?: (limit?: number) => Promise<Array<{ externalId: string; invoiceNo: string; amount: number }>>;
}

export interface PaymentAdapter {
  key: string;
  /** Create a payment link / iDEAL redirect for a dealer to pay an invoice. */
  createPaymentLink: (params: {
    invoiceId: string;
    amount: number;
    currency: string;
    description: string;
    redirectUrl: string;
    webhookUrl: string;
  }) => Promise<{ paymentId: string; checkoutUrl: string }>;
  /** Setup a SEPA Direct Debit mandate for recurring collection. */
  createMandate?: (params: { dealerId: string; iban: string; signedDate: string }) => Promise<{ mandateId: string }>;
}

export interface ShippingAdapter {
  key: string;
  /** Create a shipping label for an order. */
  createLabel: (params: {
    orderId: string;
    receiverName: string;
    receiverAddress: string;
    receiverPostcode: string;
    receiverCity: string;
    receiverCountry: string;
    weight: number;
  }) => Promise<{ trackingNumber: string; labelUrl: string }>;
  /** Track an existing shipment by tracking number. */
  trackShipment?: (trackingNumber: string) => Promise<{ status: string; deliveredAt?: string }>;
}

export interface EinvoiceAdapter {
  key: string;
  /** Send a Peppol UBL invoice to the receiver via the network. */
  sendInvoice: (params: {
    invoiceXml: string;
    receiverPeppolId: string;
  }) => Promise<{ documentId: string }>;
}

export class AdapterNotReadyError extends Error {
  constructor(category: string, key: string) {
    super(`Adapter henüz hazır değil: ${category}/${key}. Faz 5/6/8'de implement edilecek.`);
    this.name = "AdapterNotReadyError";
  }
}

// ── User-bound adapter selection lookup ─────────────────────────────────

interface AdapterSelection {
  accounting?: string;
  payment?: string;
  shipping?: string;
  einvoice?: string;
}

/**
 * Read user's enabled adapter selection from profiles.metadata.
 * Returns empty object if user hasn't filled the bayi-profil form yet.
 */
export async function getUserAdapterSelection(userId: string): Promise<AdapterSelection> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const adapters = (meta.enabled_adapters || {}) as Record<string, string>;
  return {
    accounting: adapters.accounting,
    payment: adapters.payment,
    shipping: adapters.shipping,
    einvoice: adapters.einvoice,
  };
}

// ── Resolver functions (lazy-load per category) ─────────────────────────
// Implementation adapters live in src/tenants/bayi/adapters/<category>/<key>/
// MVP: tüm adapter'lar stub — çağırınca AdapterNotReadyError fırlatır.

export async function resolveAccountingAdapter(userId: string): Promise<AccountingAdapter | null> {
  const sel = await getUserAdapterSelection(userId);
  if (!sel.accounting || sel.accounting === "none" || sel.accounting === "other") return null;

  // Faz 5: Chift Unified API ile yuki/exact/snelstart desteklendi. CHIFT_API_KEY
  // env-var ve user connection tamamlanmışsa gerçek API; yoksa stub fallback
  // (her metod AdapterNotReadyError throw eder, çağıran kod yakalar).
  if (sel.accounting === "yuki" || sel.accounting === "exact" || sel.accounting === "snelstart") {
    const { buildChiftAccountingAdapter } = await import("./accounting/chift");
    return buildChiftAccountingAdapter(userId, sel.accounting);
  }

  // logo_nl / mikro — Türkiye muhasebe yazılımları, ileri faz (TR pazarı
  // genişletilince doğrudan API ile bağlanılacak; Chift bu yazılımları
  // şu an desteklemiyor).
  return makeStub<AccountingAdapter>("accounting", sel.accounting, [
    "getDealerBalance", "pushInvoice", "listRecentInvoices",
  ]);
}

export async function resolvePaymentAdapter(userId: string): Promise<PaymentAdapter | null> {
  const sel = await getUserAdapterSelection(userId);
  if (!sel.payment || sel.payment === "none" || sel.payment === "manual") return null;

  // Faz 6: Mollie iDEAL + SEPA Direct Debit. MOLLIE_API_KEY env-var
  // varsa gerçek API; yoksa graceful stub fallback.
  if (sel.payment === "mollie") {
    const { buildMolliePaymentAdapter } = await import("./payment/mollie");
    return buildMolliePaymentAdapter();
  }

  // stripe / iyzico — ileri faz (TR pazarı genişletilince Iyzico, global
  // genişlemede Stripe).
  return makeStub<PaymentAdapter>("payment", sel.payment, ["createPaymentLink", "createMandate"]);
}

export async function resolveShippingAdapter(userId: string): Promise<ShippingAdapter | null> {
  const sel = await getUserAdapterSelection(userId);
  if (!sel.shipping || sel.shipping === "other" || sel.shipping === "own_fleet") return null;
  // Faz 8'de PostNL import edilecek.
  return makeStub<ShippingAdapter>("shipping", sel.shipping, ["createLabel", "trackShipment"]);
}

export async function resolveEinvoiceAdapter(userId: string): Promise<EinvoiceAdapter | null> {
  const sel = await getUserAdapterSelection(userId);
  if (!sel.einvoice || sel.einvoice === "none") return null;
  // İleri faz: Storecove Peppol Access Point.
  return makeStub<EinvoiceAdapter>("einvoice", sel.einvoice, ["sendInvoice"]);
}

// ── Stub factory ────────────────────────────────────────────────────────
// Her stub, key + AdapterNotReadyError fırlatan method'lara sahip. Çağıran
// kod try/catch ile yakalayıp kullanıcıya "Henüz hazır değil" mesajı gösterir.

function makeStub<T>(category: string, key: string, methods: string[]): T {
  const stub = { key } as Record<string, unknown>;
  for (const method of methods) {
    stub[method] = async () => {
      throw new AdapterNotReadyError(category, key);
    };
  }
  return stub as T;
}
