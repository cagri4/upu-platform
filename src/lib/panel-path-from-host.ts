/**
 * Browser host → tenant panel path mapping.
 *
 * Client tarafında çalışır (window erişir) — server config import edemediği
 * için subdomain prefix'leri burada hardcoded; src/tenants/config.ts
 * DOMAIN_MAP ile senkron tutulmalı. Bilinmeyen host → emlak default.
 *
 * Çağıran SSR guard yapmalı (`typeof window !== "undefined"`). SSR'da
 * çağrılırsa exception atar (deterministik fail) — sessizce yanlış path
 * üretmesin.
 */
export function panelPathFromHost(): string {
  if (typeof window === "undefined") {
    throw new Error("panelPathFromHost() requires browser context");
  }
  const host = window.location.host;
  if (host.startsWith("retailai.")) return "/tr/bayi-panel";
  if (host.startsWith("marketai.")) return "/tr/market-panelim";
  if (host.startsWith("hotelai.")) return "/tr/otel-panel";
  if (host.startsWith("restoranai.")) return "/tr/restoran-panel";
  if (host.startsWith("residenceai.")) return "/tr/site";
  return "/tr/panel";
}
