/**
 * /[locale]/giris — Server wrapper.
 *
 * Tenant'a göre header brand adı + mobile WA deep link için pre-fill mesaj
 * (waText) hesaplar. uye-ol/page.tsx ile simetrik pattern.
 *
 *   - TENANT_AWARE_IDENTITY=false (default): "Giriş yap"
 *   - TENANT_AWARE_IDENTITY=true + bayi: "BAYI: Giriş yap"
 *   - ... her tenant için UPPERCASE prefix.
 *
 * Bot tarafı router.ts "Giriş yap" intent'i bu prefix'i tanır
 * (resolveTenantContext + tenant-identity.ts).
 */
import { headers } from "next/headers";
import { isTenantAwareIdentityEnabled } from "@/platform/auth/tenant-identity";
import { getTenantBrandShort } from "@/platform/tenants/brand";
import { getTenantPanelPath } from "@/platform/auth/qr";
import GirisClient from "./_components/GirisClient";

const BASE_TEXT = "Giriş yap";

function buildWaText(tenantKey: string | null, flagOn: boolean): string {
  if (!flagOn || !tenantKey) return BASE_TEXT;
  return `${tenantKey.toUpperCase()}: ${BASE_TEXT}`;
}

export default async function GirisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const isAdminHost = h.get("x-is-admin") === "true";
  const flagOn = isTenantAwareIdentityEnabled();
  const brandName = isAdminHost ? getTenantBrandShort("admin") : getTenantBrandShort(tenantKey);
  const waText = buildWaText(tenantKey, flagOn);
  const panelPath = isAdminHost ? `/${locale}/admin` : getTenantPanelPath(tenantKey);
  return (
    <GirisClient
      brandName={brandName}
      waText={waText}
      locale={locale}
      panelPath={panelPath}
      isAdminHost={isAdminHost}
    />
  );
}
