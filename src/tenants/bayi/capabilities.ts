/**
 * Bayi tenant — capability registry.
 *
 * The pivot: menus are no longer scoped by "virtual employee" (owner
 * sees all 8, dealer sees only bayiAsistan). Instead each user has a
 * capability list in profiles.capabilities. WA commands and web panel
 * routes declare what capability is required; UI is filtered to match.
 *
 * "*" = wildcard (full access). Owner default = "*".
 * Dealer default = DEALER_PRESET below.
 * Employee default = whatever the owner ticks during the invite flow.
 *
 * Faz 3 (2026-04): 23 → 40 capability genişlemesi. Manager onay,
 * kredi limiti, iskonto, territory variant'ları + 7 pozisyon presetı
 * (Satış Müdürü, Muhasebeci, Tahsildar, Depocu, Lojistikçi, Ürün
 * Müdürü, Bayi Çalışanı) eklendi. Hierarchy / risk threshold mantığı
 * mevcut helper'lara dokunmadan upper layer'da uygulanır.
 */

export const BAYI_CAPABILITIES = {
  // ── Sipariş ───────────────────────────────────────────────────────────
  ORDERS_CREATE: "orders:create",
  ORDERS_VIEW: "orders:view",
  ORDERS_CANCEL: "orders:cancel",
  ORDERS_APPROVE_LARGE: "orders:approve-large",   // Manager onayı (büyük tutar)
  ORDERS_DISCOUNT: "orders:discount",              // İskonto verme yetkisi
  ORDERS_VIEW_OWN: "orders:view-own",              // Dealer-scoped: kendi siparişleri
  ORDERS_VIEW_TERRITORY: "orders:view-territory",  // Bölge müdürü: kendi bölgesi

  // ── Bayi ağı (CRM) ────────────────────────────────────────────────────
  DEALERS_INVITE: "dealers:invite",
  DEALERS_APPROVE: "dealers:approve",              // Yeni bayi başvuru onayı
  DEALERS_VIEW: "dealers:view",
  DEALERS_EDIT: "dealers:edit",
  DEALERS_VIEW_TERRITORY: "dealers:view-territory",
  DEALERS_CREDIT_LIMIT: "dealers:credit-limit",    // Kredi limiti belirleme

  // ── Stok / Depo ───────────────────────────────────────────────────────
  STOCK_VIEW: "stock:view",
  STOCK_EDIT: "stock:edit",
  STOCK_ADJUST_APPROVE: "stock:adjust-approve",    // Stok düzeltme onayı (manager)
  STOCK_PURCHASE: "stock:purchase",
  STOCK_PURCHASE_APPROVE: "stock:purchase-approve", // Satın alma onayı

  // ── Finans ────────────────────────────────────────────────────────────
  FINANCE_INVOICES: "finance:invoices",
  FINANCE_PAYMENTS: "finance:payments",
  FINANCE_BALANCE: "finance:balance",
  FINANCE_WRITE_OFF: "finance:write-off",          // Alacak silme (CFO yetkisi)
  FINANCE_DISCOUNT_APPROVE: "finance:discount-approve", // İskonto onayı
  FINANCE_INVOICES_OWN: "finance:invoices-own",
  FINANCE_BALANCE_OWN: "finance:balance-own",

  // ── Kampanya / Pazarlama ──────────────────────────────────────────────
  CAMPAIGNS_CREATE: "campaigns:create",
  CAMPAIGNS_VIEW: "campaigns:view",
  CAMPAIGNS_APPROVE: "campaigns:approve",          // Marka onayı (büyük kampanya)

  // ── Lojistik ──────────────────────────────────────────────────────────
  DELIVERIES_VIEW: "deliveries:view",
  DELIVERIES_ASSIGN: "deliveries:assign",
  DELIVERIES_CONFIRM: "deliveries:confirm",        // Sürücü/teslimat görevlisi: teslim onayı

  // ── Ürün / Katalog ────────────────────────────────────────────────────
  PRODUCTS_VIEW: "products:view",
  PRODUCTS_EDIT: "products:edit",
  PRODUCTS_PRICE_APPROVE: "products:price-approve", // Fiyat değişikliği onayı

  // ── Rapor / BI ────────────────────────────────────────────────────────
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",                // Excel/CSV export

  // ── Yönetim ───────────────────────────────────────────────────────────
  EMPLOYEES_MANAGE: "employees:manage",
  AUDIT_VIEW: "audit:view",                        // Audit log görüntüleme
} as const;

export type BayiCapability = typeof BAYI_CAPABILITIES[keyof typeof BAYI_CAPABILITIES];

/** Wildcard — grants every capability. Owner default. */
export const OWNER_ALL = "*";

/** Default capability set a new dealer (bayi sahibi) gets on bayi-davet acceptance. */
export const DEALER_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.ORDERS_CREATE,
  BAYI_CAPABILITIES.ORDERS_VIEW_OWN,
  BAYI_CAPABILITIES.FINANCE_BALANCE_OWN,
  BAYI_CAPABILITIES.FINANCE_INVOICES_OWN,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
];

// ── Pozisyon Presetleri (Faz 3) ─────────────────────────────────────────
// Owner /calisanekle ile çalışan davet ederken pozisyon dropdown'ından
// preset seçer; checkbox listesi pre-fill olur, owner rafineleştirir.
// Satış Temsilcisi senior versiyonu = Satış Müdürü; aralarındaki tek
// gerçek fark APPROVE_LARGE / DISCOUNT_APPROVE yetkisi.

export const SALES_MANAGER_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.ORDERS_VIEW,
  BAYI_CAPABILITIES.ORDERS_CREATE,
  BAYI_CAPABILITIES.ORDERS_APPROVE_LARGE,
  BAYI_CAPABILITIES.ORDERS_DISCOUNT,
  BAYI_CAPABILITIES.DEALERS_VIEW,
  BAYI_CAPABILITIES.DEALERS_EDIT,
  BAYI_CAPABILITIES.CAMPAIGNS_CREATE,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
  BAYI_CAPABILITIES.REPORTS_VIEW,
  BAYI_CAPABILITIES.REPORTS_EXPORT,
];

export const SALES_REP_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.ORDERS_CREATE,
  BAYI_CAPABILITIES.ORDERS_VIEW_TERRITORY,
  BAYI_CAPABILITIES.DEALERS_VIEW_TERRITORY,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
];

export const ACCOUNTANT_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.FINANCE_INVOICES,
  BAYI_CAPABILITIES.FINANCE_PAYMENTS,
  BAYI_CAPABILITIES.FINANCE_BALANCE,
  BAYI_CAPABILITIES.DEALERS_VIEW,
  BAYI_CAPABILITIES.ORDERS_VIEW,
  BAYI_CAPABILITIES.REPORTS_VIEW,
  BAYI_CAPABILITIES.REPORTS_EXPORT,
];

export const COLLECTION_OFFICER_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.FINANCE_INVOICES,
  BAYI_CAPABILITIES.FINANCE_PAYMENTS,
  BAYI_CAPABILITIES.FINANCE_BALANCE,
  BAYI_CAPABILITIES.DEALERS_VIEW,
  BAYI_CAPABILITIES.DEALERS_VIEW_TERRITORY,
];

export const WAREHOUSE_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.STOCK_VIEW,
  BAYI_CAPABILITIES.STOCK_EDIT,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
  BAYI_CAPABILITIES.DELIVERIES_VIEW,
];

export const LOGISTICS_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.DELIVERIES_VIEW,
  BAYI_CAPABILITIES.DELIVERIES_ASSIGN,
  BAYI_CAPABILITIES.DELIVERIES_CONFIRM,
  BAYI_CAPABILITIES.ORDERS_VIEW,
];

export const PRODUCT_MANAGER_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
  BAYI_CAPABILITIES.PRODUCTS_EDIT,
  BAYI_CAPABILITIES.PRODUCTS_PRICE_APPROVE,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
  BAYI_CAPABILITIES.STOCK_VIEW,
  BAYI_CAPABILITIES.REPORTS_VIEW,
];

export const DEALER_EMPLOYEE_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.ORDERS_CREATE,
  BAYI_CAPABILITIES.ORDERS_VIEW_OWN,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
];

/**
 * Pozisyon → preset tablo. /calisanekle formundaki dropdown bunu kullanır.
 * Türkçe etiketleri (label) UI için, key sistem içi.
 */
export const POSITION_PRESETS: Record<string, { label: string; preset: readonly BayiCapability[] }> = {
  sales_manager:    { label: "Satış Müdürü",      preset: SALES_MANAGER_PRESET },
  sales_rep:        { label: "Satış Temsilcisi",  preset: SALES_REP_PRESET },
  accountant:       { label: "Muhasebeci",        preset: ACCOUNTANT_PRESET },
  collection_officer:{ label: "Tahsildar",        preset: COLLECTION_OFFICER_PRESET },
  warehouse:        { label: "Depocu",            preset: WAREHOUSE_PRESET },
  logistics:        { label: "Lojistikçi",        preset: LOGISTICS_PRESET },
  product_manager:  { label: "Ürün Müdürü",       preset: PRODUCT_MANAGER_PRESET },
  dealer_employee:  { label: "Bayi Çalışanı",     preset: DEALER_EMPLOYEE_PRESET },
};

/** Human-readable labels for the çalışan davet web form checkboxes. */
export const CAPABILITY_LABELS: Record<BayiCapability, { label: string; group: string }> = {
  // Sipariş
  [BAYI_CAPABILITIES.ORDERS_CREATE]:          { label: "Sipariş oluştur",          group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_VIEW]:            { label: "Tüm siparişleri gör",      group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_CANCEL]:          { label: "Sipariş iptal",            group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_APPROVE_LARGE]:   { label: "Büyük tutar onayla",       group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_DISCOUNT]:        { label: "İskonto verme",            group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_VIEW_OWN]:        { label: "Kendi siparişleri",        group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_VIEW_TERRITORY]:  { label: "Bölge siparişleri",        group: "Sipariş" },

  // Bayi ağı
  [BAYI_CAPABILITIES.DEALERS_INVITE]:         { label: "Bayi davet",               group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_APPROVE]:        { label: "Bayi başvuru onayı",       group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_VIEW]:           { label: "Tüm bayileri gör",         group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_EDIT]:           { label: "Bayi düzenle",             group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_VIEW_TERRITORY]: { label: "Bölge bayileri gör",       group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_CREDIT_LIMIT]:   { label: "Kredi limit belirle",      group: "Bayi ağı" },

  // Stok
  [BAYI_CAPABILITIES.STOCK_VIEW]:             { label: "Stok görüntüle",           group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_EDIT]:             { label: "Stok düzenle",             group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_ADJUST_APPROVE]:   { label: "Stok düzeltme onayı",      group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_PURCHASE]:         { label: "Satın alma yap",           group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_PURCHASE_APPROVE]: { label: "Satın alma onayı",         group: "Stok" },

  // Finans
  [BAYI_CAPABILITIES.FINANCE_INVOICES]:       { label: "Faturalar",                group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_PAYMENTS]:       { label: "Ödeme/tahsilat",           group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_BALANCE]:        { label: "Bakiye raporu",            group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_WRITE_OFF]:      { label: "Alacak silme",             group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_DISCOUNT_APPROVE]:{ label: "İskonto onayı",           group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_INVOICES_OWN]:   { label: "Kendi faturalarım",        group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_BALANCE_OWN]:    { label: "Kendi bakiyem",            group: "Finans" },

  // Kampanya
  [BAYI_CAPABILITIES.CAMPAIGNS_CREATE]:       { label: "Kampanya oluştur",         group: "Kampanya" },
  [BAYI_CAPABILITIES.CAMPAIGNS_VIEW]:         { label: "Kampanyaları gör",         group: "Kampanya" },
  [BAYI_CAPABILITIES.CAMPAIGNS_APPROVE]:      { label: "Kampanya onayı",           group: "Kampanya" },

  // Lojistik
  [BAYI_CAPABILITIES.DELIVERIES_VIEW]:        { label: "Teslimatları gör",         group: "Lojistik" },
  [BAYI_CAPABILITIES.DELIVERIES_ASSIGN]:      { label: "Teslimat ata",             group: "Lojistik" },
  [BAYI_CAPABILITIES.DELIVERIES_CONFIRM]:     { label: "Teslim onayı",             group: "Lojistik" },

  // Ürün
  [BAYI_CAPABILITIES.PRODUCTS_VIEW]:          { label: "Ürünleri gör",             group: "Ürün" },
  [BAYI_CAPABILITIES.PRODUCTS_EDIT]:          { label: "Ürün düzenle",             group: "Ürün" },
  [BAYI_CAPABILITIES.PRODUCTS_PRICE_APPROVE]: { label: "Fiyat değişikliği onayı",  group: "Ürün" },

  // Rapor
  [BAYI_CAPABILITIES.REPORTS_VIEW]:           { label: "Raporları gör",            group: "Rapor" },
  [BAYI_CAPABILITIES.REPORTS_EXPORT]:         { label: "Excel/CSV export",         group: "Rapor" },

  // Yönetim
  [BAYI_CAPABILITIES.EMPLOYEES_MANAGE]:       { label: "Çalışan yönet",            group: "Yönetim" },
  [BAYI_CAPABILITIES.AUDIT_VIEW]:             { label: "Audit log görüntüle",      group: "Yönetim" },
};

/**
 * Default capability set for a profile being created with the given role.
 * Owner (admin/user) gets wildcard, dealer gets DEALER_PRESET, employee
 * starts empty (owner picks via /calisanekle web form OR position preset).
 *
 * Centralized here so every signup INSERT site (whatsapp webhook, register,
 * admin invite) seeds capabilities consistently — otherwise new owners
 * land with capabilities='{}' and the router gate refuses every command.
 *
 * Position parametresi opsiyonel: verilirse POSITION_PRESETS'ten okunur,
 * verilmezse rol bazlı default uygulanır.
 */
export function defaultCapabilitiesForRole(
  role: string | null | undefined,
  position?: string | null,
): string[] {
  if (role === "admin" || role === "user") return [OWNER_ALL];
  if (role === "dealer") return [...DEALER_PRESET];
  if (role === "employee" && position && POSITION_PRESETS[position]) {
    return [...POSITION_PRESETS[position].preset];
  }
  return [];
}

/**
 * Does the user's capability list grant the required capability?
 * Wildcard "*" grants everything.
 * Passing `null` for required means "no capability needed".
 */
export function hasCapability(userCaps: string[] | null | undefined, required: string | null | undefined): boolean {
  if (!required) return true;
  if (!userCaps || userCaps.length === 0) return false;
  if (userCaps.includes(OWNER_ALL)) return true;
  return userCaps.includes(required);
}

/**
 * Given an ordered list of candidate capabilities, return the first one
 * the user has. Useful when a command has multiple ways to be authorized
 * (e.g. a dealer can see their own orders, but an owner sees all).
 */
export function firstMatchingCapability(userCaps: string[] | null | undefined, candidates: string[]): string | null {
  if (!userCaps || userCaps.length === 0) return null;
  if (userCaps.includes(OWNER_ALL)) return candidates[0] || null;
  return candidates.find((c) => userCaps.includes(c)) || null;
}
