/**
 * UPU Platform — Tenant Configuration
 *
 * Each SaaS is a "tenant" with its own config, employees, commands, and domain.
 * Domain-based routing: middleware detects domain → loads correct tenant config.
 */

export interface VirtualEmployee {
  key: string;
  name: string;
  icon: string;
  description: string;
  commands: string[];
}

export interface TenantConfig {
  key: string;
  name: string;
  slug: string;          // subdomain: slug.upudev.nl
  tenantId: string;      // Supabase tenant ID
  saasType: string;
  domain?: string;       // Custom domain (e.g., emlakofisi.ai)
  icon: string;
  color: string;         // Primary brand color
  description: string;
  employees: VirtualEmployee[];
  commandMap: Record<string, string>;  // command → handler file
}

// ─── Tenant Registry ─────────────────────────────────────────────────────

const TENANTS: Record<string, TenantConfig> = {
  emlak: {
    key: "emlak",
    name: "Emlak Ofisi",
    slug: "estateai",
    tenantId: "3f3598fc-a93e-4c73-bd33-7c4217f6c089",
    saasType: "emlak",
    icon: "🏠",
    color: "#4F46E5",
    description: "Emlak danışmanları için AI destekli sanal ofis ekibi",
    employees: [
      { key: "portfoy", name: "Portföy Sorumlusu", icon: "🗂", description: "Mülk yönetimi", commands: ["portfoyum", "mulkekle", "mulkdetay", "mulkduzenle", "mulksil", "tara", "ekle"] },
      { key: "satis", name: "Satış Destek Uzmanı", icon: "🤝", description: "Müşteri ve eşleştirme", commands: ["musterilerim", "musteriEkle", "musteriDuzenle", "eslestir", "hatirlatma", "takipEt", "satistavsiye", "ortakpazar"] },
      { key: "medya", name: "Medya Uzmanı", icon: "🎬", description: "Fotoğraf ve yayın", commands: ["fotograf", "yayinla", "paylas", "websitem"] },
      { key: "pazar", name: "Pazar Analisti", icon: "📊", description: "Fiyat ve analiz", commands: ["fiyatsor", "degerle", "mulkoner", "analiz", "rapor", "trend"] },
      { key: "sekreter", name: "Sekreter", icon: "📋", description: "Brifing ve görevler", commands: ["brifing", "gorevler", "sozlesme", "sozlesmelerim", "hediyeler"] },
    ],
    commandMap: {},
  },
  bayi: {
    key: "bayi",
    name: "Bayi Yönetimi",
    slug: "retailai",
    tenantId: "32f5feda-700f-44c6-a270-5bbb5a040994",
    saasType: "bayi",
    icon: "📦",
    color: "#059669",
    description: "Bayi ağı yönetimi için AI destekli sanal ekip",
    employees: [],
    commandMap: {},
  },
  muhasebe: {
    key: "muhasebe",
    name: "Muhasebe Asistanı",
    slug: "accountai",
    tenantId: "31a22a5a-cf38-48b5-914d-a67bde4c1e16",
    saasType: "muhasebe",
    icon: "📊",
    color: "#7C3AED",
    description: "Muhasebe büroları için AI destekli sanal ekip",
    employees: [],
    commandMap: {},
  },
  otel: {
    key: "otel",
    name: "Otel Yönetimi",
    slug: "hotelai",
    tenantId: "16871326-afef-4ba3-a079-2c5ede8fac4d",
    saasType: "otel",
    icon: "🏨",
    color: "#DC2626",
    description: "Oteller için AI destekli sanal ekip",
    employees: [],
    commandMap: {},
  },
  siteyonetim: {
    key: "siteyonetim",
    name: "Site Yönetimi",
    slug: "residenceai",
    tenantId: "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e",
    saasType: "siteyonetim",
    icon: "🏢",
    color: "#0891B2",
    description: "Konut ve site yönetimi için AI destekli sanal ekip",
    employees: [],
    commandMap: {},
  },
};

// ─── Domain → Tenant mapping ─────────────────────────────────────────────

const DOMAIN_MAP: Record<string, string> = {
  // Subdomains
  "estateai.upudev.nl": "emlak",
  "retailai.upudev.nl": "bayi",
  "accountai.upudev.nl": "muhasebe",
  "hotelai.upudev.nl": "otel",
  "residenceai.upudev.nl": "siteyonetim",
  "panel.upudev.nl": "admin",
  // Localhost development
  "localhost:3000": "emlak",
  // Custom domains (add as purchased)
  // "emlakofisi.ai": "emlak",
};

export function getTenantByDomain(hostname: string): TenantConfig | null {
  const key = DOMAIN_MAP[hostname];
  if (!key || key === "admin") return null;
  return TENANTS[key] || null;
}

export function getTenantByKey(key: string): TenantConfig | null {
  return TENANTS[key] || null;
}

export function isAdminDomain(hostname: string): boolean {
  return DOMAIN_MAP[hostname] === "admin";
}

export function getAllTenants(): TenantConfig[] {
  return Object.values(TENANTS);
}

export { TENANTS, DOMAIN_MAP };
