/**
 * Desktop QR login — tenant subdomain ve panel URL eşlemesi.
 *
 * QR claim/finish akışında mobil panel hangi tenant'a aitse, desktop
 * tarayıcı o tenant'ın subdomain'ine + panel ana URL'ine yönlendirilir.
 */

export type TenantKey =
  | "emlak"
  | "bayi"
  | "market"
  | "otel"
  | "restoran"
  | "siteyonetim";

interface TenantPanelInfo {
  slug: string;       // subdomain prefix (slug.upudev.nl)
  panelPath: string;  // panel ana URL'i
}

const TENANT_PANEL: Record<TenantKey, TenantPanelInfo> = {
  emlak:       { slug: "estateai",    panelPath: "/tr/panel" },
  bayi:        { slug: "retailai",    panelPath: "/tr/bayi-panel" },
  market:      { slug: "marketai",    panelPath: "/tr/market-panelim" },
  otel:        { slug: "hotelai",     panelPath: "/tr/otel-panel" },
  restoran:    { slug: "restoranai",  panelPath: "/tr/restoran-panel" },
  siteyonetim: { slug: "residenceai", panelPath: "/tr/site" },
};

export function getTenantPanelUrl(tenantKey: string): string | null {
  const info = TENANT_PANEL[tenantKey as TenantKey];
  if (!info) return null;
  return `https://${info.slug}.upudev.nl${info.panelPath}`;
}

/**
 * Tenant'a göre panel ana sayfasının path'ini döner (locale segmenti dahil).
 *
 * Auth akışlarında (giris, uye-ol, google callback) post-login redirect
 * targeti olarak kullanılır. Tenant key tanınmazsa emlak default'una düşer.
 */
export function getTenantPanelPath(tenantKey: string | null | undefined): string {
  if (!tenantKey) return TENANT_PANEL.emlak.panelPath;
  const info = TENANT_PANEL[tenantKey as TenantKey];
  return info ? info.panelPath : TENANT_PANEL.emlak.panelPath;
}

export function isValidTenantKey(value: unknown): value is TenantKey {
  return typeof value === "string" && value in TENANT_PANEL;
}

export function generateQrCode(): string {
  // 32-char URL-safe random — QR ekranında uzun olmasın diye 24-bayt → 32-char base64url
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64url");
}

export const QR_TTL_SECONDS = 60;
