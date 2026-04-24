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
 */

export const BAYI_CAPABILITIES = {
  ORDERS_CREATE: "orders:create",
  ORDERS_VIEW: "orders:view",
  ORDERS_CANCEL: "orders:cancel",

  DEALERS_INVITE: "dealers:invite",
  DEALERS_VIEW: "dealers:view",
  DEALERS_EDIT: "dealers:edit",

  STOCK_VIEW: "stock:view",
  STOCK_EDIT: "stock:edit",
  STOCK_PURCHASE: "stock:purchase",

  FINANCE_INVOICES: "finance:invoices",
  FINANCE_PAYMENTS: "finance:payments",
  FINANCE_BALANCE: "finance:balance",

  CAMPAIGNS_CREATE: "campaigns:create",
  CAMPAIGNS_VIEW: "campaigns:view",

  DELIVERIES_VIEW: "deliveries:view",
  DELIVERIES_ASSIGN: "deliveries:assign",

  PRODUCTS_VIEW: "products:view",
  PRODUCTS_EDIT: "products:edit",

  REPORTS_VIEW: "reports:view",
  EMPLOYEES_MANAGE: "employees:manage",

  // Dealer-scoped variants (limit to "own" rows only)
  ORDERS_VIEW_OWN: "orders:view-own",
  FINANCE_BALANCE_OWN: "finance:balance-own",
  FINANCE_INVOICES_OWN: "finance:invoices-own",
} as const;

export type BayiCapability = typeof BAYI_CAPABILITIES[keyof typeof BAYI_CAPABILITIES];

/** Wildcard — grants every capability. Owner default. */
export const OWNER_ALL = "*";

/** Default capability set a new dealer gets on bayi-davet acceptance. */
export const DEALER_PRESET: BayiCapability[] = [
  BAYI_CAPABILITIES.ORDERS_CREATE,
  BAYI_CAPABILITIES.ORDERS_VIEW_OWN,
  BAYI_CAPABILITIES.FINANCE_BALANCE_OWN,
  BAYI_CAPABILITIES.FINANCE_INVOICES_OWN,
  BAYI_CAPABILITIES.CAMPAIGNS_VIEW,
  BAYI_CAPABILITIES.PRODUCTS_VIEW,
];

/** Human-readable labels for the çalışan davet web form checkboxes. */
export const CAPABILITY_LABELS: Record<BayiCapability, { label: string; group: string }> = {
  [BAYI_CAPABILITIES.ORDERS_CREATE]:       { label: "Sipariş oluştur",        group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_VIEW]:         { label: "Siparişleri görüntüle",  group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_CANCEL]:       { label: "Sipariş iptal",          group: "Sipariş" },
  [BAYI_CAPABILITIES.ORDERS_VIEW_OWN]:     { label: "Kendi siparişleri",      group: "Sipariş" },

  [BAYI_CAPABILITIES.DEALERS_INVITE]:      { label: "Bayi davet",             group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_VIEW]:        { label: "Bayileri görüntüle",     group: "Bayi ağı" },
  [BAYI_CAPABILITIES.DEALERS_EDIT]:        { label: "Bayi düzenle",           group: "Bayi ağı" },

  [BAYI_CAPABILITIES.STOCK_VIEW]:          { label: "Stok görüntüle",         group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_EDIT]:          { label: "Stok düzenle",           group: "Stok" },
  [BAYI_CAPABILITIES.STOCK_PURCHASE]:      { label: "Satın alma yap",         group: "Stok" },

  [BAYI_CAPABILITIES.FINANCE_INVOICES]:    { label: "Faturalar",              group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_PAYMENTS]:    { label: "Ödeme/tahsilat",         group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_BALANCE]:     { label: "Bakiye raporu",          group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_INVOICES_OWN]:{ label: "Kendi faturalarım",      group: "Finans" },
  [BAYI_CAPABILITIES.FINANCE_BALANCE_OWN]: { label: "Kendi bakiyem",          group: "Finans" },

  [BAYI_CAPABILITIES.CAMPAIGNS_CREATE]:    { label: "Kampanya oluştur",       group: "Kampanya" },
  [BAYI_CAPABILITIES.CAMPAIGNS_VIEW]:      { label: "Kampanyaları gör",       group: "Kampanya" },

  [BAYI_CAPABILITIES.DELIVERIES_VIEW]:     { label: "Teslimatları gör",       group: "Lojistik" },
  [BAYI_CAPABILITIES.DELIVERIES_ASSIGN]:   { label: "Teslimat ata",           group: "Lojistik" },

  [BAYI_CAPABILITIES.PRODUCTS_VIEW]:       { label: "Ürünleri gör",           group: "Ürün" },
  [BAYI_CAPABILITIES.PRODUCTS_EDIT]:       { label: "Ürün düzenle",           group: "Ürün" },

  [BAYI_CAPABILITIES.REPORTS_VIEW]:        { label: "Raporları gör",          group: "Rapor" },
  [BAYI_CAPABILITIES.EMPLOYEES_MANAGE]:    { label: "Çalışan yönet",          group: "Yönetim" },
};

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
