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
    defaultFavorites: ["mulkekle", "ilantakip", "fiyatbelirle", "musteriEkle", "sunum", "eslestir", "hatirlatma", "ipucu", "webpanel"],
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
    description: "Bayi ağınızın her bireyi cebinde tek UPU asistanıyla",
    welcomeFeatures: "Sipariş yönetimi, stok takibi, bayi ağı yönetimi ve daha fazlasını",
    employees: [
      { key: "asistan", name: "Asistan", icon: "📊", description: "Günlük özet, takvim ve hatırlatmalar", commands: ["ozet", "takvim", "hatirlatma", "rapor"] },
      { key: "satisMuduru", name: "Satış Müdürü", icon: "💰", description: "Kampanya, teklif ve performans analizi", commands: ["kampanyaolustur", "kampanyalar", "teklifver", "performans", "segment"] },
      { key: "satisTemsilcisi", name: "Satış Temsilcisi", icon: "🤝", description: "Sipariş alma, ürün önerisi, ziyaret yönetimi", commands: ["siparisolustur", "siparisler", "bayidurum", "ziyaretnotu", "ziyaretler"] },
      { key: "muhasebeci", name: "Muhasebeci", icon: "💳", description: "Bakiye, fatura takibi ve hesap ekstresi", commands: ["bakiye", "faturalar", "borcdurum", "ekstre", "odeme"] },
      { key: "tahsildar", name: "Tahsildar", icon: "📋", description: "Vadesi gelen ödemeler ve tahsilat takibi", commands: ["vadeler", "tahsilat", "hatirlatgonder"] },
      { key: "depocu", name: "Depocu", icon: "📦", description: "Stok durumu, kritik stok ve tedarik yönetimi", commands: ["stok", "kritikstok", "stokhareketleri", "tedarikciler", "satinalma"] },
      { key: "lojistikci", name: "Lojistikçi", icon: "🚛", description: "Teslimat planlaması ve kargo takibi", commands: ["teslimatlar", "rota", "kargotakip"] },
      { key: "urunYoneticisi", name: "Ürün Yöneticisi", icon: "🏷", description: "Ürün kataloğu ve fiyat listesi", commands: ["urunler", "fiyatliste", "yeniurun", "fiyatguncelle"] },
      { key: "ekipYonetimi", name: "Ekip Yönetimi", icon: "👥", description: "Çalışan ve bayi iletişimi", commands: ["calisanekle", "calisanyonet", "talimat", "kampanyabildir", "tahsilatbildir", "duyuru"] },
      { key: "bayiAsistan", name: "Bayi Asistanı", icon: "🤖", description: "Sipariş, bakiye, katalog ve kampanyalar", commands: ["siparisver", "siparislerim", "tekrarsiparis", "bakiyem", "faturalarim", "odemelerim", "fiyatlar", "aktifkampanyalar", "mesajgonder"] },
    ],
    dealerEmployees: ["bayiAsistan"],
    commandMap: {},
    guide: "",
    defaultFavorites: ["ozet", "siparisler", "stok"],
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
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["brifing", "durum", "rezervasyonlar"],
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
