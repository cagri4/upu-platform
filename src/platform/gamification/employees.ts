/**
 * Employee Definitions — virtual employee metadata + tier thresholds.
 *
 * Each tenant has a set of virtual employees. An employee is a "job"
 * in RPG terms — it has its own XP pool and tier ladder. Users level up
 * each employee independently by completing missions and daily tasks
 * tagged with that employee's key.
 */

// ── Tier definitions ────────────────────────────────────────────────

export const TIER_NAMES: Record<number, string> = {
  1: "Stajyer",
  2: "Junior",
  3: "Senior",
  4: "Expert",
  5: "Master",
};

export const TIER_STARS: Record<number, string> = {
  1: "⭐",
  2: "⭐⭐",
  3: "⭐⭐⭐",
  4: "⭐⭐⭐⭐",
  5: "⭐⭐⭐⭐⭐",
};

/** XP required to REACH each tier (cumulative). */
export const TIER_THRESHOLDS: number[] = [
  0,     // tier 1 — Stajyer (start)
  100,   // tier 2 — Junior
  300,   // tier 3 — Senior
  600,   // tier 4 — Expert
  1000,  // tier 5 — Master
];

export const MAX_TIER = 5;

// ── User meta-rank (Emlak Danışmanı rütbesi) ────────────────────────

export const USER_RANK_NAMES: Record<number, string> = {
  1: "Stajyer Emlak Danışmanı",
  2: "Junior Emlak Danışmanı",
  3: "Senior Emlak Danışmanı",
  4: "Expert Emlak Danışmanı",
  5: "Master Emlak Danışmanı",
};

/**
 * User rank is derived from the sum of all employee tiers.
 * 5 employees × 5 max tier = 25 total. Thresholds:
 */
export const USER_RANK_THRESHOLDS: number[] = [
  0,   // rank 1 — sum 0-4
  5,   // rank 2 — sum 5-9
  10,  // rank 3 — sum 10-14
  15,  // rank 4 — sum 15-19
  20,  // rank 5 — sum 20-25
];

// ── Employee definitions per tenant ─────────────────────────────────

export interface EmployeeDefinition {
  key: string;
  name: string;
  icon: string;
  description: string;
}

const EMLAK_EMPLOYEES: EmployeeDefinition[] = [
  { key: "portfoy", name: "Portföy Sorumlusu", icon: "🏠", description: "Mülk ekleme, düzenleme, foto, yönetim" },
  { key: "satis", name: "Satış Destek", icon: "🤝", description: "Müşteri, eşleştirme, sunum, takip" },
  { key: "analist", name: "Pazar Analisti", icon: "📊", description: "Analiz, trend, rapor, değerleme" },
  { key: "sekreter", name: "Sekreter", icon: "📋", description: "Brifing, takvim, organizasyon" },
  { key: "medya", name: "Medya Uzmanı", icon: "📱", description: "Paylaş, yayınla, içerik" },
];

const BAYI_ADMIN_EMPLOYEES: EmployeeDefinition[] = [
  { key: "urun", name: "Ürün Yöneticisi", icon: "📦", description: "Ürün ekleme, stok, katalog" },
  { key: "siparis", name: "Sipariş Yöneticisi", icon: "🛒", description: "Sipariş, teslimat, onay" },
  { key: "finans", name: "Finans Sorumlusu", icon: "💰", description: "Tahsilat, bakiye, fatura" },
  { key: "bayi_ag", name: "Bayi Ağı Yöneticisi", icon: "🏪", description: "Bayi davet, ilişki, kampanya" },
  { key: "iletisim", name: "İletişim Uzmanı", icon: "📢", description: "Duyuru, bildirim, bilgilendirme" },
];

const TENANT_EMPLOYEES: Record<string, EmployeeDefinition[]> = {
  emlak: EMLAK_EMPLOYEES,
  bayi: BAYI_ADMIN_EMPLOYEES,
  // Other tenants added as their gamification comes online
};

export function getEmployees(tenantKey: string): EmployeeDefinition[] {
  return TENANT_EMPLOYEES[tenantKey] || [];
}

export function getEmployee(tenantKey: string, employeeKey: string): EmployeeDefinition | undefined {
  return getEmployees(tenantKey).find(e => e.key === employeeKey);
}

// ── XP daily cap ────────────────────────────────────────────────────

export const DAILY_XP_CAP = 200;
