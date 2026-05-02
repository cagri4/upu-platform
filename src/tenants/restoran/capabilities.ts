/**
 * Restoran tenant — capability registry.
 *
 * Bayi pattern uyarlaması: profiles.capabilities array'i her kullanıcı
 * için ne yapabileceğini tutar. Owner default = ["*"] (wildcard).
 * Personel davet edilince owner preset'ten seçer.
 *
 * MVP scope (5-7 cap): demo için yeter. V2'de KDS/POS/finance açıldığında
 * genişletilir.
 */

export const RESTORAN_CAPABILITIES = {
  // ── Sipariş + Masa ─────────────────────────────────────────────────────
  ORDERS_VIEW: "orders:view",
  ORDERS_MANAGE: "orders:manage",        // sipariş aç/güncelle/iptal/öde

  // ── Rezervasyon ────────────────────────────────────────────────────────
  RESERVATIONS_VIEW: "reservations:view",
  RESERVATIONS_MANAGE: "reservations:manage",  // ekle/iptal/onayla

  // ── Menü + Stok ────────────────────────────────────────────────────────
  MENU_VIEW: "menu:view",
  MENU_EDIT: "menu:edit",
  INVENTORY_VIEW: "inventory:view",
  INVENTORY_EDIT: "inventory:edit",

  // ── Sadakat (müdavim) ──────────────────────────────────────────────────
  LOYALTY_VIEW: "loyalty:view",
  LOYALTY_MANAGE: "loyalty:manage",      // üye ekle/sil/mesaj broadcast

  // ── Rapor + Yönetim ────────────────────────────────────────────────────
  REPORTS_VIEW: "reports:view",          // brifing, gün sonu, ciro
  EMPLOYEES_MANAGE: "employees:manage",  // çalışan davet/sil
} as const;

export type RestoranCapability = typeof RESTORAN_CAPABILITIES[keyof typeof RESTORAN_CAPABILITIES];

/** Wildcard — owner default. */
export const OWNER_ALL = "*";

// ── Pozisyon Presetleri ────────────────────────────────────────────────
// /calisanekle web formunda dropdown bunu kullanır (V4 personel sonra port).
// Şimdilik MVP'de sadece preset listesi tanımlı; uygulanması V4.

export const MANAGER_PRESET: RestoranCapability[] = [
  RESTORAN_CAPABILITIES.ORDERS_VIEW,
  RESTORAN_CAPABILITIES.ORDERS_MANAGE,
  RESTORAN_CAPABILITIES.RESERVATIONS_VIEW,
  RESTORAN_CAPABILITIES.RESERVATIONS_MANAGE,
  RESTORAN_CAPABILITIES.MENU_VIEW,
  RESTORAN_CAPABILITIES.MENU_EDIT,
  RESTORAN_CAPABILITIES.INVENTORY_VIEW,
  RESTORAN_CAPABILITIES.INVENTORY_EDIT,
  RESTORAN_CAPABILITIES.LOYALTY_VIEW,
  RESTORAN_CAPABILITIES.LOYALTY_MANAGE,
  RESTORAN_CAPABILITIES.REPORTS_VIEW,
];

export const STAFF_PRESET: RestoranCapability[] = [
  RESTORAN_CAPABILITIES.ORDERS_VIEW,
  RESTORAN_CAPABILITIES.ORDERS_MANAGE,
  RESTORAN_CAPABILITIES.RESERVATIONS_VIEW,
  RESTORAN_CAPABILITIES.RESERVATIONS_MANAGE,
  RESTORAN_CAPABILITIES.MENU_VIEW,
];

export const KITCHEN_PRESET: RestoranCapability[] = [
  RESTORAN_CAPABILITIES.ORDERS_VIEW,
  RESTORAN_CAPABILITIES.MENU_VIEW,
  RESTORAN_CAPABILITIES.INVENTORY_VIEW,
  RESTORAN_CAPABILITIES.INVENTORY_EDIT,
];

/** Sadakat üyesi (müşteri) — minimum görünürlük. */
export const LOYALTY_MEMBER_PRESET: RestoranCapability[] = [
  RESTORAN_CAPABILITIES.MENU_VIEW,
  RESTORAN_CAPABILITIES.RESERVATIONS_VIEW,
];

export const POSITION_PRESETS: Record<string, { label: string; preset: readonly RestoranCapability[] }> = {
  manager: { label: "Müdür",   preset: MANAGER_PRESET },
  staff:   { label: "Servis",  preset: STAFF_PRESET },
  kitchen: { label: "Mutfak",  preset: KITCHEN_PRESET },
};

export const CAPABILITY_LABELS: Record<RestoranCapability, { label: string; group: string }> = {
  [RESTORAN_CAPABILITIES.ORDERS_VIEW]:        { label: "Siparişleri gör",            group: "Sipariş" },
  [RESTORAN_CAPABILITIES.ORDERS_MANAGE]:      { label: "Sipariş aç/kapat/öde",       group: "Sipariş" },
  [RESTORAN_CAPABILITIES.RESERVATIONS_VIEW]:  { label: "Rezervasyon listesi",        group: "Rezervasyon" },
  [RESTORAN_CAPABILITIES.RESERVATIONS_MANAGE]:{ label: "Rezervasyon ekle/iptal",     group: "Rezervasyon" },
  [RESTORAN_CAPABILITIES.MENU_VIEW]:          { label: "Menüyü gör",                 group: "Menü" },
  [RESTORAN_CAPABILITIES.MENU_EDIT]:          { label: "Menü düzenle",               group: "Menü" },
  [RESTORAN_CAPABILITIES.INVENTORY_VIEW]:     { label: "Stok görüntüle",             group: "Stok" },
  [RESTORAN_CAPABILITIES.INVENTORY_EDIT]:     { label: "Stok düzenle",               group: "Stok" },
  [RESTORAN_CAPABILITIES.LOYALTY_VIEW]:       { label: "Müdavim listesi",            group: "Sadakat" },
  [RESTORAN_CAPABILITIES.LOYALTY_MANAGE]:     { label: "Müdavim ekle/mesaj",         group: "Sadakat" },
  [RESTORAN_CAPABILITIES.REPORTS_VIEW]:       { label: "Brifing + raporlar",         group: "Rapor" },
  [RESTORAN_CAPABILITIES.EMPLOYEES_MANAGE]:   { label: "Çalışan yönet",              group: "Yönetim" },
};

/**
 * Default capability set for new profiles. Owner wildcard, employee
 * preset-based, loyalty member kısıtlı set.
 */
export function defaultCapabilitiesForRole(
  role: string | null | undefined,
  position?: string | null,
): string[] {
  if (role === "admin" || role === "user") return [OWNER_ALL];
  if (role === "employee" && position && POSITION_PRESETS[position]) {
    return [...POSITION_PRESETS[position].preset];
  }
  if (role === "employee") return [...STAFF_PRESET];
  // Loyalty member: profile.role === "user" + metadata.loyalty_member = true
  // veya ayrı bir custom role; MVP'de loyalty kullanıcısı için ayrı role yok,
  // service-role akışıyla data scope ediliyor.
  return [];
}

export function hasCapability(userCaps: string[] | null | undefined, required: string | null | undefined): boolean {
  if (!required) return true;
  if (!userCaps || userCaps.length === 0) return false;
  if (userCaps.includes(OWNER_ALL)) return true;
  return userCaps.includes(required);
}

export function firstMatchingCapability(userCaps: string[] | null | undefined, candidates: string[]): string | null {
  if (!userCaps || userCaps.length === 0) return null;
  if (userCaps.includes(OWNER_ALL)) return candidates[0] || null;
  return candidates.find((c) => userCaps.includes(c)) || null;
}
