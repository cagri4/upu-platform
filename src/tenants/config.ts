/**
 * UPU Platform — Tenant Configuration
 *
 * Each SaaS is a "tenant" with its own config, employees, commands, and domain.
 * Domain-based routing: middleware detects domain → loads correct tenant config.
 */

import type { SupportedCurrency, SupportedLocale } from "@/platform/i18n/currency";

export interface VirtualEmployee {
  key: string;
  name: string;
  icon: string;
  description: string;
  commands: string[];
}

export interface TenantPricingTier {
  price: number;
  currency: SupportedCurrency;
}

/**
 * Setup ücreti — opsiyonel, taksit destekli. Tenant default'u kullanmak
 * istemeyen müşteri "self-service" yolundan setup'sız da geçebilir.
 */
export interface TenantSetupTier {
  price: number;
  currency: SupportedCurrency;
  optional: boolean;
  installments: number;
}

/**
 * Referral / launch promo — ilk N müşteriye setup ücretsiz + ay başına
 * indirimli abonelik. Pazarlama mesajı için tek noktada tutuluyor.
 */
export interface TenantReferralPromo {
  firstN: number;
  setupWaived: boolean;
  monthlyDiscount: number;        // 0..1 oranı (0.5 = %50 indirim)
  monthsDiscounted: number;
}

/**
 * İade policy — müşteri X gün içinde iade isterse ödediğini geri alır.
 * Stripe billing tarafında "refund created" akışı bu config'e göre
 * çalışır. fullRefund=true tüm ödemeyi (abonelik + setup) iade eder;
 * false sadece abonelik kısmını.
 */
export interface TenantRefundPolicy {
  firstNDays: number;             // İade süresi (gün)
  fullRefund: boolean;            // true = setup + abonelik; false = sadece abonelik
}

/**
 * Adapter listesi — kullanıcı onboarding sırasında muhasebe yazılımını
 * seçer; seçim profile.metadata.accounting_provider'a kaydedilir,
 * runtime'da `src/tenants/<tenant>/adapters/` resolver tarafından okunur.
 *
 * 2026-05-02 stratejisi: distribütör kendi tedarikçisini kullanıyor —
 * kargo, ödeme tahsilatı, e-fatura katmanlarına karışmıyoruz. Sadece
 * muhasebe entegrasyonu (Yuki/Exact/SnelStart Chift unified + Logo TR
 * iskelet).
 */
export interface TenantAdapterCatalog {
  accounting?: string[];
}

export interface TenantConfig {
  key: string;
  name: string;
  slug: string;          // subdomain: slug.upudev.nl
  tenantId: string;      // Supabase tenant ID
  saasType: string;
  domain?: string;       // Custom domain (e.g., emlakofisi.ai)
  whatsappPhone: string; // Bot WhatsApp number (e.g., "31644967207")
  icon: string;
  color: string;         // Primary brand color
  description: string;
  welcomeFeatures: string; // Tenant-specific feature summary for welcome message
  employees: VirtualEmployee[];
  dealerEmployees?: string[];  // Employee keys visible to dealer role
  commandMap: Record<string, string>;
  guide: string;         // SaaS-specific usage guide text
  defaultFavorites: string[];  // Default favorite command names
  pricing: {
    starter: TenantPricingTier;
    pro: TenantPricingTier;
    growth?: TenantPricingTier;
    setup?: TenantSetupTier;
    referral?: TenantReferralPromo;
    refund?: TenantRefundPolicy;
  };

  // Multi-locale framework — opsiyonel, eklenmemişse platform default
  // (EUR + tr-NL) uygulanır. Her tenant kendi pazarına göre seçer.
  country?: string;                       // ISO 2-letter (NL, TR, BE, DE)
  defaultCurrency?: SupportedCurrency;
  defaultLocale?: SupportedLocale;
  supportedCountries?: string[];
  supportedCurrencies?: SupportedCurrency[];
  supportedLocales?: SupportedLocale[];
  availableAdapters?: TenantAdapterCatalog;
}

// ─── Tenant Registry ─────────────────────────────────────────────────────

const TENANTS: Record<string, TenantConfig> = {
  emlak: {
    key: "emlak",
    name: "Emlak Ofisi",
    slug: "estateai",
    tenantId: "3f3598fc-a93e-4c73-bd33-7c4217f6c089",
    saasType: "emlak",
    whatsappPhone: "31644967207",
    icon: "🏠",
    color: "#4F46E5",
    description: "Emlak danışmanları için AI destekli sanal ofis ekibi",
    welcomeFeatures: "Portföy yönetimi, müşteri takibi, fiyat analizi ve daha fazlasını",
    employees: [
      { key: "portfoy", name: "Portföy Sorumlusu", icon: "🗂", description: "Mülk yönetimi", commands: ["portfoyum", "mulkekle", "mulkyonet"] },
      { key: "satis", name: "Satış Destek Uzmanı", icon: "🤝", description: "Müşteri ve eşleştirme", commands: ["musterilerim", "musteriEkle", "musteriDuzenle", "musteriTakip", "eslestir", "hatirlatma", "takipEt", "satistavsiye", "ortakpazar", "sunum", "sunumlarim"] },
      { key: "medya", name: "Medya Uzmanı", icon: "🎬", description: "Fotoğraf ve yayın", commands: ["fotograf", "yayinla", "paylas", "websitem"] },
      { key: "pazar", name: "Pazar Analisti", icon: "📊", description: "Fiyat ve analiz", commands: ["fiyatbelirle", "mulkoner", "rapor"] },
      { key: "sekreter", name: "Sekreter", icon: "📋", description: "Brifing ve görevler", commands: ["brifing", "gorevler", "sozlesme", "sozlesmelerim", "hediyeler"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["mulkekle", "mulklerim", "portfoyara", "ilantakip", "sunumolustur", "sunumlarim", "musteriEkle", "websayfam", "profilduzenle", "fiyatbelirle", "eslestir", "hatirlatma", "webpanel"],
    pricing: {
      starter: { price: 59, currency: "EUR" },
      pro: { price: 95, currency: "EUR" },
    },
  },
  bayi: {
    key: "bayi",
    name: "Bayi Yönetimi",
    slug: "retailai",
    tenantId: "32f5feda-700f-44c6-a270-5bbb5a040994",
    saasType: "bayi",
    whatsappPhone: "31644967207",
    icon: "📦",
    color: "#059669",
    description: "Türk dağıtıcılar için AI + WhatsApp destekli bayi satış portalı",
    welcomeFeatures: "WhatsApp'tan sipariş alma, AI tahsilat asistanı, saha satış yönetimi, kampanya bildirimi ve muhasebe entegrasyonu",
    // Tek-asistan vizyon: 8 sanal eleman kalıntısı kaldırıldı.
    // Komut menüsü artık capability seti üzerinden filtreleniyor
    // (registry.requiredCapabilities), employee gruplaması yok.
    employees: [],
    commandMap: {},
    guide: "",
    defaultFavorites: ["ozet", "siparisler", "stok"],
    pricing: {
      starter: { price: 99, currency: "EUR" },
      growth: { price: 249, currency: "EUR" },
      pro: { price: 599, currency: "EUR" },
      setup: { price: 749, currency: "EUR", optional: true, installments: 3 },
      referral: { firstN: 10, setupWaived: true, monthlyDiscount: 0.5, monthsDiscounted: 3 },
      refund: { firstNDays: 30, fullRefund: true },
    },
    country: "NL",
    defaultCurrency: "EUR",
    defaultLocale: "tr-NL",
    supportedCountries: ["NL", "TR", "BE", "DE"],
    supportedCurrencies: ["EUR", "TRY"],
    supportedLocales: ["tr-NL", "tr-TR", "nl-NL", "en-US"],
    availableAdapters: {
      accounting: ["yuki", "exact", "snelstart", "logo", "none"],
    },
  },
  muhasebe: {
    key: "muhasebe",
    name: "Muhasebe Asistanı",
    slug: "accountai",
    tenantId: "31a22a5a-cf38-48b5-914d-a67bde4c1e16",
    saasType: "muhasebe",
    whatsappPhone: "31644967207",
    icon: "📊",
    color: "#7C3AED",
    description: "Muhasebe büroları için AI destekli sanal ekip",
    welcomeFeatures: "Fatura takibi, vergi hesaplama, alacak yönetimi ve daha fazlasını",
    employees: [
      { key: "faturaUzmani", name: "Fatura İşleme Uzmanı", icon: "📄", description: "e-Fatura yükleme, arama ve hesap kodu önerisi", commands: ["fatura_yukle", "son_faturalar", "fatura_ara", "fatura_detay", "fatura_rapor", "fatura_ekle"] },
      { key: "sekreter", name: "Sekreter", icon: "📅", description: "Beyanname takvimi, randevu ve mükellef yönetimi", commands: ["mukellefler", "mukellef_ekle", "mukellef_detay", "takvim", "yaklasan", "randevular", "randevu_ekle", "brifing"] },
      { key: "vergiUzmani", name: "Vergi Uzmanı", icon: "🧮", description: "KDV hesaplama, vergi raporu ve beyanname kontrol", commands: ["kdv", "gelir_vergisi", "kurumlar", "vergi_raporu", "kontrol", "oranlar"] },
      { key: "tahsilatUzmani", name: "Tahsilat Uzmanı", icon: "💰", description: "Alacak takibi, geciken ödemeler ve nakit akış", commands: ["alacaklar", "geciken", "hatirlatma_gonder", "odeme_ekle", "nakit_akis", "risk", "gider_ekle", "donem_ozeti", "banka_mutabakat"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["brifing", "son_faturalar", "alacaklar"],
    pricing: {
      starter: { price: 19, currency: "EUR" },
      pro: { price: 89, currency: "EUR" },
    },
  },
  otel: {
    key: "otel",
    name: "Otel Yönetimi",
    slug: "hotelai",
    tenantId: "16871326-afef-4ba3-a079-2c5ede8fac4d",
    saasType: "otel",
    whatsappPhone: "31644967207",
    icon: "🏨",
    color: "#DC2626",
    description: "Oteller için AI destekli sanal ekip",
    welcomeFeatures: "Rezervasyon yönetimi, oda takibi, misafir deneyimi ve daha fazlasını",
    employees: [
      { key: "resepsiyon", name: "Resepsiyon", icon: "🛎️", description: "Misafir karşılama, mesaj yönetimi ve eskalasyon", commands: ["misafirler", "mesajlar", "yanitla", "eskalasyon"] },
      { key: "rezervasyon", name: "Rezervasyon Uzmanı", icon: "📅", description: "Müsaitlik, fiyat sorgulama ve check-in/out", commands: ["rezervasyonlar", "checkin", "checkout", "musaitlik", "fiyat", "rezervasyonekle"] },
      { key: "katHizmetleri", name: "Kat Hizmetleri", icon: "🧹", description: "Oda durumu, temizlik ve görev atama", commands: ["odalar", "temizlik", "odaguncelle", "gorevata"] },
      { key: "misafirDeneyimi", name: "Misafir Deneyimi", icon: "⭐", description: "Bilgi bankası, tavsiye ve yorum yönetimi", commands: ["faq", "odabilgi", "tavsiye", "yorumlar", "brifing"] },
      { key: "muhasebe", name: "Muhasebe", icon: "💰", description: "Gelir, fatura ve finansal raporlar", commands: ["gelir", "rapor", "doluluk", "brifing"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["brifing", "durum", "rezervasyonlar"],
    pricing: {
      starter: { price: 29, currency: "EUR" },
      pro: { price: 59, currency: "EUR" },
    },
  },
  siteyonetim: {
    key: "siteyonetim",
    name: "Site Yönetimi",
    slug: "residenceai",
    tenantId: "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e",
    saasType: "siteyonetim",
    whatsappPhone: "31644967207",
    icon: "🏢",
    color: "#0891B2",
    description: "Konut ve site yönetimi için AI destekli sanal ekip",
    welcomeFeatures: "Aidat takibi, arıza bildirimi, duyuru yönetimi ve daha fazlasını",
    employees: [
      { key: "muhasebeci", name: "Muhasebeci", icon: "💰", description: "Aidat, borç durumu, gelir-gider ve tahakkuk", commands: ["borcum", "rapor", "aidat", "gelir_gider"] },
      { key: "sekreter", name: "Sekreter", icon: "📝", description: "Duyuru, toplantı çağrısı ve sakin iletişimi", commands: ["duyuru", "toplanti", "mesaj"] },
      { key: "teknisyen", name: "Teknisyen", icon: "🔧", description: "Arıza bildirimi, bakım ve onarım takibi", commands: ["ariza", "bakim", "durum"] },
      { key: "hukukMusaviri", name: "Hukuk Müşaviri", icon: "⚖️", description: "KMK mevzuatı, hak ve yükümlülükler", commands: ["hukuk", "mevzuat"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["borcum", "rapor", "ariza"],
    pricing: {
      starter: { price: 39, currency: "EUR" },
      pro: { price: 75, currency: "EUR" },
    },
  },
  market: {
    key: "market",
    name: "Market Yönetimi",
    slug: "marketai",
    tenantId: "af1f27b0-2ec1-4423-9b93-2aa29979b73a",
    saasType: "market",
    whatsappPhone: "31644967207",
    icon: "🛒",
    color: "#F59E0B",
    description: "Marketler için AI destekli stok ve satış yönetimi",
    welcomeFeatures: "Stok yönetimi, sipariş takibi, satış raporları ve daha fazlasını",
    employees: [
      { key: "stokSorumlusu", name: "Stok Sorumlusu", icon: "📦", description: "Ürün, stok, SKT ve kategori yönetimi", commands: ["stokekle", "stokguncelle", "stoksil", "stoksorgula", "sktkontrol", "sktekle", "kategoriler", "kategoriekle"] },
      { key: "siparisYoneticisi", name: "Sipariş Yöneticisi", icon: "📋", description: "Tedarikçi, sipariş ve teslimat yönetimi", commands: ["tedarikciekle", "tedarikciler", "siparisolustur", "siparisekle", "siparisler", "siparisdetay", "siparisonayla", "siparisiptal", "teslimal", "teslimatlar"] },
      { key: "finansAnalisti", name: "Finans Analisti", icon: "💰", description: "Fiyat, kampanya, satış ve kasa raporları", commands: ["fiyatguncelle", "fiyatkampanya", "fiyatsorgula", "satiskaydet", "raporgunluk", "raporhaftalik", "raporaylik", "topsatan", "kasarapor", "brifing"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["stoksorgula", "raporgunluk", "siparisler"],
    pricing: {
      starter: { price: 49, currency: "EUR" },
      pro: { price: 75, currency: "EUR" },
    },
  },
  restoran: {
    key: "restoran",
    name: "Restoran Asistanı",
    slug: "restoranai",
    tenantId: "03f58dcb-b931-4dcf-bd47-a0885f9286e8",
    saasType: "restoran",
    whatsappPhone: "31644967207",
    icon: "🍽",
    color: "#EA580C",
    description: "Restoran ve cafe işletmecileri için AI destekli sanal ekip",
    welcomeFeatures: "Sipariş yönetimi, masa & rezervasyon, stok takibi, AI müşteri asistanı",
    employees: [
      { key: "asistan", name: "Asistan", icon: "📋", description: "Günlük brifing, gün sonu özeti", commands: ["brifing", "gunsonu", "ozet"] },
      { key: "servis", name: "Servis", icon: "🍽", description: "Sipariş, masa ve rezervasyon yönetimi", commands: ["siparis", "masa", "rezervasyon"] },
      { key: "mutfakStok", name: "Mutfak / Stok", icon: "📦", description: "Stok takibi ve menü yönetimi", commands: ["stok", "menukalemleri"] },
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["siparis", "masa", "rezervasyon", "stok", "brifing", "menukalemleri"],
    pricing: {
      starter: { price: 29, currency: "EUR" },
      pro: { price: 49, currency: "EUR" },
    },
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
  "marketai.upudev.nl": "market",
  "restoranai.upudev.nl": "restoran",
  "adminpanel.upudev.nl": "admin",
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
