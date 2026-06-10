/**
 * Logo Tiger REST client — Faz 3 Sprint J.
 *
 * Tenant ayarlarından (provider='logo_tiger') host/port/firma_kodu +
 * username/password okur. Logo Tiger / LogoConnect API'sine HTTP isteği
 * atar. Auth pattern: Basic auth (user:pass) — bazı kurulumlarda token
 * exchange var ama MVP'de Basic.
 *
 * MOCK MOD:
 *   Yapılandırılmamış veya inactive → tüm fetch fonksiyonları mock veri
 *   döner (UI test edilebilir + dağıtıcı entegrasyon hazırlanırken
 *   gerçekçi senaryo görür).
 *
 * LIVE MOD:
 *   host=https://logo.firma.com, firma_kodu=001, vb. yapılandırıldığında
 *   gerçek REST çağrısı yapılır. Endpoint paths Logo doc'unda değişebilir
 *   (LogoConnect vs Tiger Sync); MVP'de en yaygın path'leri kullanırız,
 *   prod entegrasyonunda site-specific override gerekirse settings.config
 *   içine `paths.products` vb. eklenir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIntegrationSetting } from "@/platform/integrations/tenant-settings";
import type {
  LogoCariHesap,
  LogoPriceListItem,
  LogoProduct,
  LogoStockSnapshot,
} from "./types";

interface LogoClientConfig {
  host: string;
  port: number | null;
  firmaKodu: string;
  username: string;
  password: string;
}

async function getConfig(
  sb: SupabaseClient,
  tenantId: string,
): Promise<LogoClientConfig | null> {
  const setting = await getIntegrationSetting(sb, tenantId, "logo_tiger");
  if (!setting || !setting.isActive) return null;
  const host = (setting.config.host as string) || "";
  const firmaKodu = (setting.config.firma_kodu as string) || "";
  const username = (setting.secrets.username as string) || "";
  const password = (setting.secrets.password as string) || "";
  if (!host || !firmaKodu || !username || !password) return null;
  return {
    host: host.replace(/\/+$/, ""),
    port: setting.config.port != null ? Number(setting.config.port) : null,
    firmaKodu,
    username,
    password,
  };
}

function authHeader(cfg: LogoClientConfig): string {
  const creds = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
  return `Basic ${creds}`;
}

function endpointUrl(cfg: LogoClientConfig, path: string): string {
  const portPart = cfg.port ? `:${cfg.port}` : "";
  return `${cfg.host}${portPart}/api/v1/${cfg.firmaKodu}${path}`;
}

async function logoGet<T>(
  cfg: LogoClientConfig,
  path: string,
): Promise<T> {
  const res = await fetch(endpointUrl(cfg, path), {
    headers: {
      Authorization: authHeader(cfg),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Logo ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// ──────────────────────────────────────────────────────────────────────
// Mock data — dağıtıcı yapılandırma yapmadan UI test
// ──────────────────────────────────────────────────────────────────────
function mockProducts(): LogoProduct[] {
  return [
    {
      code: "LGO-SP-500",
      name: "Spagetti 500g (Logo)",
      description: "Logo Tiger'dan senkron — örnek",
      barcode: "8690000010001",
      brand: "MockBrand",
      unit: "koli",
      basePrice: 28.5,
      vatRate: 8,
      categoryName: "Makarna",
    },
    {
      code: "LGO-KN-400",
      name: "Konserve Bezelye 400g (Logo)",
      description: null,
      barcode: "8690000010002",
      brand: "MockBrand",
      unit: "adet",
      basePrice: 21,
      vatRate: 8,
      categoryName: "Konserve",
    },
    {
      code: "LGO-RZ-1000",
      name: "Pirinç Baldo 1kg (Logo)",
      description: "Mock — Logo canlı bağlantı sonrası gerçek veri.",
      barcode: "8690000010003",
      brand: "MockBrand",
      unit: "koli",
      basePrice: 52,
      vatRate: 8,
      categoryName: "Bakliyat",
    },
  ];
}

function mockStock(): LogoStockSnapshot[] {
  return [
    { productCode: "LGO-SP-500", warehouse: "Merkez Depo", quantity: 240 },
    { productCode: "LGO-KN-400", warehouse: "Merkez Depo", quantity: 480 },
    { productCode: "LGO-RZ-1000", warehouse: "Merkez Depo", quantity: 90 },
  ];
}

function mockPrices(): LogoPriceListItem[] {
  return [
    {
      priceListCode: "DEFAULT",
      priceListName: "Logo Varsayılan Liste",
      productCode: "LGO-SP-500",
      unitPrice: 28.5,
      currency: "TRY",
    },
    {
      priceListCode: "DEFAULT",
      priceListName: "Logo Varsayılan Liste",
      productCode: "LGO-KN-400",
      unitPrice: 21,
      currency: "TRY",
    },
    {
      priceListCode: "A_SEGMENT",
      priceListName: "Logo A-Segment",
      productCode: "LGO-SP-500",
      unitPrice: 25,
      currency: "TRY",
    },
  ];
}

function mockDealers(): LogoCariHesap[] {
  return [
    {
      code: "120-001",
      name: "Logo Mock Bayi 1 / Yıldız Market",
      taxNumber: "1234567890",
      taxOffice: "Kadıköy",
      address: "Logo mock — Caddebostan",
      city: "Istanbul",
      phone: "+905551110001",
      email: "yildiz@mockmarket.com",
      creditLimit: 50000,
      paymentTermDays: 30,
    },
    {
      code: "120-002",
      name: "Logo Mock Bayi 2 / Bizim Toptan",
      taxNumber: "2345678901",
      taxOffice: "Şişli",
      address: "Logo mock — Mecidiyeköy",
      city: "Istanbul",
      phone: "+905551110002",
      email: "bizim@mocktoptan.com",
      creditLimit: 25000,
      paymentTermDays: 15,
    },
  ];
}

// ──────────────────────────────────────────────────────────────────────
// Fetch fonksiyonları — config yoksa mock, varsa live REST
// ──────────────────────────────────────────────────────────────────────
export async function fetchProducts(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ items: LogoProduct[]; mocked: boolean }> {
  const cfg = await getConfig(sb, tenantId);
  if (!cfg) return { items: mockProducts(), mocked: true };
  // Live path placeholder. Logo doc'unda site-specific path varyasyonları
  // var; prod sözleşmesi gelince override edilir.
  const data = await logoGet<{ items?: LogoProduct[] }>(cfg, "/products");
  return { items: data.items ?? [], mocked: false };
}

export async function fetchStock(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ items: LogoStockSnapshot[]; mocked: boolean }> {
  const cfg = await getConfig(sb, tenantId);
  if (!cfg) return { items: mockStock(), mocked: true };
  const data = await logoGet<{ items?: LogoStockSnapshot[] }>(cfg, "/stock");
  return { items: data.items ?? [], mocked: false };
}

export async function fetchPrices(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ items: LogoPriceListItem[]; mocked: boolean }> {
  const cfg = await getConfig(sb, tenantId);
  if (!cfg) return { items: mockPrices(), mocked: true };
  const data = await logoGet<{ items?: LogoPriceListItem[] }>(cfg, "/pricelists");
  return { items: data.items ?? [], mocked: false };
}

export async function fetchDealers(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ items: LogoCariHesap[]; mocked: boolean }> {
  const cfg = await getConfig(sb, tenantId);
  if (!cfg) return { items: mockDealers(), mocked: true };
  const data = await logoGet<{ items?: LogoCariHesap[] }>(cfg, "/cariler");
  return { items: data.items ?? [], mocked: false };
}
