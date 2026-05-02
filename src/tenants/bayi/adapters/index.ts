/**
 * Adapter Resolver — bayi tenant'ı için entegrasyon noktası.
 *
 * 2026-05-02 stratejisi:
 *   - Distribütör kendi tedarikçilerini kullanıyor: kargo (PostNL/DHL/
 *     kendi araç), ödeme tahsilatı (kendi banka/Mollie), e-fatura
 *     (zaten muhasebe yazılımı yapar). Bayi tenant bu katmanlara
 *     karışmıyor.
 *   - Geriye sadece **muhasebe entegrasyonu** kalıyor: Yuki/Exact/
 *     SnelStart (Chift unified) + Logo (TR ileri faz iskelet).
 *
 * Plug-in seçimi: profile.metadata.accounting_provider =
 *   "yuki" | "exact" | "snelstart" | "logo" | "none"
 *
 * "none" = manuel mod: müşteri CSV import + elle ürün/bayi ekler,
 * adapter çağrısı yok.
 */

import { getServiceClient } from "@/platform/auth/supabase";

// ── Accounting adapter contract — read-only operations ──────────────────
// Gerçek dağıtıcı muhasebesinde fatura/ödeme yazma akışı kompleks
// (KDV/BTW kuralları, mutabakat, çift kayıt). Bu nedenle MVP'de SADECE
// okuma operasyonları: bayi/ürün listesi, cari bakiye, açık fatura,
// son ödemeler. Yazma akışı v2'ye atılı (muhasebeci yine kendi yazılımı
// üzerinde fatura keser).

export interface AccountingAdapter {
  key: string;
  /** List dealers/customers from accounting system (master data sync). */
  listCustomers: () => Promise<Array<{ externalId: string; name: string; vatNumber?: string }>>;
  /** List products/items with prices (master data sync). */
  listProducts: () => Promise<Array<{ externalId: string; name: string; code?: string; unitPrice: number; vatRate: number }>>;
  /** Get current account balance for a specific dealer. */
  getCustomerBalance: (customerExternalId: string) => Promise<{ balance: number; currency: string } | null>;
  /** List open (unpaid) invoices. Optional dealer filter. */
  listOpenInvoices: (customerExternalId?: string) => Promise<Array<{ externalId: string; invoiceNo: string; amount: number; currency: string; dueDate: string }>>;
  /** List payments received since a date (for cari hesap reconciliation). */
  listPayments: (since: string) => Promise<Array<{ externalId: string; customerExternalId: string; amount: number; receivedAt: string }>>;
}

export class AdapterNotReadyError extends Error {
  constructor(category: string, key: string) {
    super(`Adapter henüz hazır değil: ${category}/${key}.`);
    this.name = "AdapterNotReadyError";
  }
}

// ── User-bound provider lookup ──────────────────────────────────────────

export type AccountingProvider = "yuki" | "exact" | "snelstart" | "logo" | "none";

/**
 * Read user's accounting provider from profile metadata.
 * Default "none" — manuel mod (CSV import, elle bayi/ürün ekleme).
 */
export async function getUserAccountingProvider(userId: string): Promise<AccountingProvider> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const provider = meta.accounting_provider as string | undefined;
  if (provider === "yuki" || provider === "exact" || provider === "snelstart" || provider === "logo") {
    return provider;
  }
  return "none";
}

// ── Resolver — plug-in lazy load ────────────────────────────────────────

export async function resolveAccountingAdapter(userId: string): Promise<AccountingAdapter | null> {
  const provider = await getUserAccountingProvider(userId);
  if (provider === "none") return null;

  // Logo: TR pazarı için iskelet — implementasyon müşteri Logo versiyonu
  // (Tiger/GO/İşbaşı) netleşince yapılacak. Şu an scaffold döner,
  // çağırılınca AdapterNotReadyError.
  if (provider === "logo") {
    const { buildLogoAccountingAdapter } = await import("./accounting/logo");
    return buildLogoAccountingAdapter();
  }

  // Yuki / Exact / SnelStart — Chift unified API ile (CHIFT_API_KEY +
  // user connection_id varsa gerçek; yoksa stub fallback).
  const { buildChiftAccountingAdapter } = await import("./accounting/chift");
  return buildChiftAccountingAdapter(userId, provider);
}
