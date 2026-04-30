/**
 * Otel tenant — capability registry.
 *
 * Same shape as bayi/capabilities.ts. Owner ('admin') has '*' wildcard.
 * Employees get a per-role preset (manager / reception / housekeeping_chief
 * / housekeeper / accountant). MVP2: F&B chief.
 *
 * Guest (role='guest') is NEW and OTEL-SPECIFIC: invited via /misafirdavet,
 * lifetime profile (capabilities never expire), accesses the system entirely
 * over WhatsApp + occasional WA-issued mekik web links (e.g. online check-in).
 *
 * Multi-property scale: profile.capabilities is the global default. Per-hotel
 * override comes from the new `hotel_employees` table (Faz B). RLS + the
 * `getEffectiveCapabilities(profile_id, hotel_id)` resolver handle scoping.
 */

export const OTEL_CAPABILITIES = {
  // ── Rezervasyon ────────────────────────────────────────
  RESERVATIONS_VIEW:        "reservations:view",
  RESERVATIONS_CREATE:      "reservations:create",
  RESERVATIONS_EDIT:        "reservations:edit",
  RESERVATIONS_CHECKIN:     "reservations:checkin",

  // ── Oda ────────────────────────────────────────────────
  ROOMS_VIEW:               "rooms:view",
  ROOMS_STATUS_EDIT:        "rooms:status-edit",
  ROOMS_CONFIG_EDIT:        "rooms:config-edit",

  // ── Kat hizmetleri ─────────────────────────────────────
  HOUSEKEEPING_VIEW:        "housekeeping:view",
  HOUSEKEEPING_VIEW_OWN:    "housekeeping:view-own",
  HOUSEKEEPING_ASSIGN:      "housekeeping:assign",
  HOUSEKEEPING_COMPLETE:    "housekeeping:complete",
  HOUSEKEEPING_COMPLETE_OWN:"housekeeping:complete-own",

  // ── Misafir (personel-tarafı) ──────────────────────────
  GUESTS_VIEW:              "guests:view",
  GUESTS_MESSAGE:           "guests:message",
  GUESTS_REVIEWS:           "guests:reviews",
  GUESTS_INVITE:            "guests:invite",         // /misafirdavet (resepsiyon+)

  // ── Müsaitlik / fiyat ──────────────────────────────────
  AVAILABILITY_VIEW:        "availability:view",
  PRICING_VIEW:             "pricing:view",
  PRICING_EDIT:             "pricing:edit",

  // ── Finans / rapor ─────────────────────────────────────
  FINANCE_VIEW:             "finance:view",
  REPORTS_VIEW:             "reports:view",

  // ── Online check-in (mekik) ────────────────────────────
  PRE_CHECKIN_VIEW:         "pre-checkin:view",       // tamamlanmış check-in'leri görüntüle
  PRE_CHECKIN_PUSH:         "pre-checkin:push",       // /cekinlink — manuel link gönder

  // ── F&B (MVP2 — preset davet formunda gizli) ───────────
  FNB_VIEW:                 "fnb:view",
  FNB_EDIT:                 "fnb:edit",

  // ── Yönetim ────────────────────────────────────────────
  ANNOUNCEMENTS:            "announcements:send",
  EMPLOYEES_MANAGE:         "employees:manage",       // owner-only (wildcard verir)

  // ── Misafir-tarafı (role='guest') — lifetime ───────────
  RESERVATIONS_VIEW_OWN:    "reservations:view-own",
  GUEST_SERVICES_VIEW:      "guest-services:view",    // hizmet listesi, wifi
  GUEST_REQUEST_CREATE:     "guest-request:create",   // talep / şikayet
  GUEST_PRE_CHECKIN_FORM:   "guest-pre-checkin:form", // mekik check-in
  GUEST_RESERVATION_CANCEL: "reservations:cancel-own",
} as const;

export type OtelCapability = typeof OTEL_CAPABILITIES[keyof typeof OTEL_CAPABILITIES];

export const OWNER_ALL = "*";

// ── Personel presetleri ───────────────────────────────────────────────────

export const MANAGER_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.RESERVATIONS_VIEW,
  OTEL_CAPABILITIES.RESERVATIONS_CREATE,
  OTEL_CAPABILITIES.RESERVATIONS_EDIT,
  OTEL_CAPABILITIES.RESERVATIONS_CHECKIN,
  OTEL_CAPABILITIES.ROOMS_VIEW,
  OTEL_CAPABILITIES.ROOMS_STATUS_EDIT,
  OTEL_CAPABILITIES.ROOMS_CONFIG_EDIT,
  OTEL_CAPABILITIES.HOUSEKEEPING_VIEW,
  OTEL_CAPABILITIES.HOUSEKEEPING_ASSIGN,
  OTEL_CAPABILITIES.HOUSEKEEPING_COMPLETE,
  OTEL_CAPABILITIES.GUESTS_VIEW,
  OTEL_CAPABILITIES.GUESTS_MESSAGE,
  OTEL_CAPABILITIES.GUESTS_REVIEWS,
  OTEL_CAPABILITIES.GUESTS_INVITE,
  OTEL_CAPABILITIES.AVAILABILITY_VIEW,
  OTEL_CAPABILITIES.PRICING_VIEW,
  OTEL_CAPABILITIES.PRICING_EDIT,
  OTEL_CAPABILITIES.FINANCE_VIEW,
  OTEL_CAPABILITIES.REPORTS_VIEW,
  OTEL_CAPABILITIES.PRE_CHECKIN_VIEW,
  OTEL_CAPABILITIES.PRE_CHECKIN_PUSH,
  OTEL_CAPABILITIES.ANNOUNCEMENTS,
];

export const RECEPTION_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.RESERVATIONS_VIEW,
  OTEL_CAPABILITIES.RESERVATIONS_CREATE,
  OTEL_CAPABILITIES.RESERVATIONS_EDIT,
  OTEL_CAPABILITIES.RESERVATIONS_CHECKIN,
  OTEL_CAPABILITIES.GUESTS_VIEW,
  OTEL_CAPABILITIES.GUESTS_MESSAGE,
  OTEL_CAPABILITIES.GUESTS_INVITE,
  OTEL_CAPABILITIES.ROOMS_VIEW,
  OTEL_CAPABILITIES.AVAILABILITY_VIEW,
  OTEL_CAPABILITIES.PRICING_VIEW,
  OTEL_CAPABILITIES.HOUSEKEEPING_VIEW,
  OTEL_CAPABILITIES.PRE_CHECKIN_VIEW,
  OTEL_CAPABILITIES.PRE_CHECKIN_PUSH,
];

export const HOUSEKEEPING_CHIEF_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.HOUSEKEEPING_VIEW,
  OTEL_CAPABILITIES.HOUSEKEEPING_ASSIGN,
  OTEL_CAPABILITIES.HOUSEKEEPING_COMPLETE,
  OTEL_CAPABILITIES.ROOMS_VIEW,
  OTEL_CAPABILITIES.ROOMS_STATUS_EDIT,
  OTEL_CAPABILITIES.GUESTS_VIEW,
];

export const HOUSEKEEPER_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.HOUSEKEEPING_VIEW_OWN,
  OTEL_CAPABILITIES.HOUSEKEEPING_COMPLETE_OWN,
  OTEL_CAPABILITIES.ROOMS_VIEW,
];

export const ACCOUNTANT_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.FINANCE_VIEW,
  OTEL_CAPABILITIES.REPORTS_VIEW,
  OTEL_CAPABILITIES.RESERVATIONS_VIEW,
];

// ── Misafir preseti — lifetime, asla silinmez ─────────────────────────────

export const GUEST_PRESET: OtelCapability[] = [
  OTEL_CAPABILITIES.RESERVATIONS_VIEW_OWN,
  OTEL_CAPABILITIES.GUEST_SERVICES_VIEW,
  OTEL_CAPABILITIES.GUEST_REQUEST_CREATE,
  OTEL_CAPABILITIES.GUEST_PRE_CHECKIN_FORM,
  OTEL_CAPABILITIES.GUEST_RESERVATION_CANCEL,
];

// ── Davet formu için preset registry ──────────────────────────────────────

export const ROLE_PRESETS = {
  manager:           { label: "Müdür",           caps: MANAGER_PRESET },
  reception:         { label: "Resepsiyon",      caps: RECEPTION_PRESET },
  housekeeping_chief:{ label: "Temizlik Şefi",   caps: HOUSEKEEPING_CHIEF_PRESET },
  housekeeper:       { label: "Kat Görevlisi",   caps: HOUSEKEEPER_PRESET },
  accountant:        { label: "Muhasebeci",      caps: ACCOUNTANT_PRESET },
} as const;

export type OtelEmployeeRoleKey = keyof typeof ROLE_PRESETS;

// ── Form etiketleri (gruplu) ──────────────────────────────────────────────

export const CAPABILITY_LABELS: Record<OtelCapability, { label: string; group: string }> = {
  [OTEL_CAPABILITIES.RESERVATIONS_VIEW]:        { label: "Rezervasyonları görüntüle", group: "Rezervasyon" },
  [OTEL_CAPABILITIES.RESERVATIONS_CREATE]:      { label: "Rezervasyon oluştur",       group: "Rezervasyon" },
  [OTEL_CAPABILITIES.RESERVATIONS_EDIT]:        { label: "Rezervasyon düzenle/iptal", group: "Rezervasyon" },
  [OTEL_CAPABILITIES.RESERVATIONS_CHECKIN]:     { label: "Check-in / Check-out",      group: "Rezervasyon" },

  [OTEL_CAPABILITIES.ROOMS_VIEW]:               { label: "Odaları görüntüle",         group: "Oda" },
  [OTEL_CAPABILITIES.ROOMS_STATUS_EDIT]:        { label: "Oda durumu (temiz/kirli)",  group: "Oda" },
  [OTEL_CAPABILITIES.ROOMS_CONFIG_EDIT]:        { label: "Oda config (tip/kapasite)", group: "Oda" },

  [OTEL_CAPABILITIES.HOUSEKEEPING_VIEW]:        { label: "Tüm temizlik görevleri",    group: "Kat Hizmetleri" },
  [OTEL_CAPABILITIES.HOUSEKEEPING_VIEW_OWN]:    { label: "Kendi görevlerim",          group: "Kat Hizmetleri" },
  [OTEL_CAPABILITIES.HOUSEKEEPING_ASSIGN]:      { label: "Görev ata",                 group: "Kat Hizmetleri" },
  [OTEL_CAPABILITIES.HOUSEKEEPING_COMPLETE]:    { label: "Görev kapat (tüm)",         group: "Kat Hizmetleri" },
  [OTEL_CAPABILITIES.HOUSEKEEPING_COMPLETE_OWN]:{ label: "Kendi görevimi kapat",      group: "Kat Hizmetleri" },

  [OTEL_CAPABILITIES.GUESTS_VIEW]:              { label: "Misafir listesi",           group: "Misafir" },
  [OTEL_CAPABILITIES.GUESTS_MESSAGE]:           { label: "Misafir mesajları",         group: "Misafir" },
  [OTEL_CAPABILITIES.GUESTS_REVIEWS]:           { label: "Yorumlar",                  group: "Misafir" },
  [OTEL_CAPABILITIES.GUESTS_INVITE]:            { label: "Misafir davet et",          group: "Misafir" },

  [OTEL_CAPABILITIES.AVAILABILITY_VIEW]:        { label: "Müsaitlik sorgu",           group: "Fiyat" },
  [OTEL_CAPABILITIES.PRICING_VIEW]:             { label: "Fiyat sorgu",               group: "Fiyat" },
  [OTEL_CAPABILITIES.PRICING_EDIT]:             { label: "Fiyat güncelle",            group: "Fiyat" },

  [OTEL_CAPABILITIES.FINANCE_VIEW]:             { label: "Gelir/finans görüntüle",    group: "Finans" },
  [OTEL_CAPABILITIES.REPORTS_VIEW]:             { label: "Brifing/raporlar",          group: "Finans" },

  [OTEL_CAPABILITIES.PRE_CHECKIN_VIEW]:         { label: "Online check-in görüntüle", group: "Online Check-in" },
  [OTEL_CAPABILITIES.PRE_CHECKIN_PUSH]:         { label: "Check-in linki gönder",     group: "Online Check-in" },

  [OTEL_CAPABILITIES.FNB_VIEW]:                 { label: "F&B siparişleri",           group: "F&B (yakında)" },
  [OTEL_CAPABILITIES.FNB_EDIT]:                 { label: "F&B yönet",                 group: "F&B (yakında)" },

  [OTEL_CAPABILITIES.ANNOUNCEMENTS]:            { label: "Ekibe duyuru",              group: "Yönetim" },
  [OTEL_CAPABILITIES.EMPLOYEES_MANAGE]:         { label: "Çalışan yönet",             group: "Yönetim" },

  // Misafir grup — davet formunda gizli (yalnızca /misafirdavet seed eder)
  [OTEL_CAPABILITIES.RESERVATIONS_VIEW_OWN]:    { label: "Kendi rezervasyonum",       group: "Misafir-Tarafı" },
  [OTEL_CAPABILITIES.GUEST_SERVICES_VIEW]:      { label: "Otel hizmetleri",           group: "Misafir-Tarafı" },
  [OTEL_CAPABILITIES.GUEST_REQUEST_CREATE]:     { label: "Talep oluştur",             group: "Misafir-Tarafı" },
  [OTEL_CAPABILITIES.GUEST_PRE_CHECKIN_FORM]:   { label: "Online check-in linki",     group: "Misafir-Tarafı" },
  [OTEL_CAPABILITIES.GUEST_RESERVATION_CANCEL]: { label: "Kendi iptalim",             group: "Misafir-Tarafı" },
};

/**
 * Default capability set for a profile being created with the given role.
 * Owner = wildcard. Employee starts empty (owner picks via davet form).
 * Guest = lifetime GUEST_PRESET.
 */
export function defaultCapabilitiesForRole(role: string | null | undefined): string[] {
  if (role === "admin" || role === "user") return [OWNER_ALL];
  if (role === "guest") return [...GUEST_PRESET];
  return [];
}

/**
 * Wildcard-aware capability check. `null`/`undefined` required = no gate.
 */
export function hasCapability(userCaps: string[] | null | undefined, required: string | null | undefined): boolean {
  if (!required) return true;
  if (!userCaps || userCaps.length === 0) return false;
  if (userCaps.includes(OWNER_ALL)) return true;
  return userCaps.includes(required);
}

/**
 * For OR-style command auth (e.g. owner global vs. dealer/guest *_OWN).
 * Returns the first capability the user has, or null.
 */
export function firstMatchingCapability(userCaps: string[] | null | undefined, candidates: string[]): string | null {
  if (!userCaps || userCaps.length === 0) return null;
  if (userCaps.includes(OWNER_ALL)) return candidates[0] || null;
  return candidates.find((c) => userCaps.includes(c)) || null;
}

// ── Form için MVP1 görünür capability listesi ─────────────────────────────
// F&B preset MVP2'de açılır; davet formunda checkbox grubu görünmez.
// Misafir-tarafı capability'leri davet formunda görünmez (sistem otomatik).
export const FORM_VISIBLE_CAPABILITIES: OtelCapability[] = (
  Object.values(OTEL_CAPABILITIES) as OtelCapability[]
).filter((c) => {
  const meta = CAPABILITY_LABELS[c];
  return meta.group !== "F&B (yakında)" && meta.group !== "Misafir-Tarafı";
});
