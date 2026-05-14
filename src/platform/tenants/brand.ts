/**
 * Tenant'a göre kısa marka adı (landing / giriş / yasal sayfa başlıkları için).
 * "UPU + key capitalized" formatına özet. AdminLayout sidebar emoji'li versiyon
 * kullanır (BAYI_BRAND_TITLE vb.); bu helper sade text sürümü.
 */
const BRAND_MAP: Record<string, string> = {
  emlak: "UPU Emlak",
  bayi: "UPU Bayi",
  market: "UPU Market",
  otel: "UPU Otel",
  restoran: "UPU Restoran",
  muhasebe: "UPU Muhasebe",
  siteyonetim: "UPU Site",
};

export function getTenantBrandShort(tenantKey: string | null | undefined): string {
  if (!tenantKey) return BRAND_MAP.emlak;
  return BRAND_MAP[tenantKey] ?? BRAND_MAP.emlak;
}
