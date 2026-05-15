/**
 * GET /manifest.json — Per-tenant dynamic PWA manifest.
 *
 * Host header'dan tenant tespit eder, tenant'a göre name/short_name/start_url/
 * theme_color döner. Her tenant (estateai/retailai/marketai/...) kendi PWA'sı
 * olarak install edilir — kullanıcının home screen'inde ayrı "UPU Emlak",
 * "UPU Bayi" vb. icon'lar.
 *
 * Middleware bu path'i PUBLIC_PATHS içinde skip eder; bu yüzden host'u
 * doğrudan request header'ından okuyoruz (x-tenant-key middleware tarafından
 * burada set edilmiyor).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTenantByDomain } from "@/tenants/config";
import { getTenantBrandShort } from "@/platform/tenants/brand";

export const dynamic = "force-dynamic";

const PANEL_START_URL: Record<string, string> = {
  emlak: "/tr/panel",
  bayi: "/tr/bayi-panel",
  market: "/tr/market-panelim",
  otel: "/tr/otel-panel",
  restoran: "/tr/restoran-panel",
  siteyonetim: "/tr/site",
  muhasebe: "/tr/panel",
};

export function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenant = getTenantByDomain(host);

  const tenantKey = tenant?.key ?? "emlak";
  const brand = getTenantBrandShort(tenantKey);
  // short_name PWA install label'ı — "UPU Bayi" gibi full brand (max 12
  // karakter spec'i Android'de yumuşak; tüm UPU brand'leri ≤12 char).
  const shortName = brand;
  const startUrl = PANEL_START_URL[tenantKey] ?? "/tr/panel";
  const themeColor = tenant?.color ?? "#1877F2";

  const manifest = {
    name: brand,
    short_name: shortName,
    description: "Yapay zeka destekli iş asistanınız.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: themeColor,
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
