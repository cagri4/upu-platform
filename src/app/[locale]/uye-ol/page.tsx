/**
 * /[locale]/uye-ol — Server wrapper.
 *
 * Tenant'a göre WA pre-fill text'i hesaplar (Sprint Foundation, flag-gated):
 *   - TENANT_AWARE_IDENTITY=false (default) veya emlak: "Üye olmak istiyorum"
 *   - TENANT_AWARE_IDENTITY=true + bayi: "BAYI: Üye olmak istiyorum"
 *   - TENANT_AWARE_IDENTITY=true + market: "MARKET: Üye olmak istiyorum" ...
 *
 * Bot tarafı resolveTenantContext helper'ı bu prefix'i tanır
 * (src/platform/auth/tenant-identity.ts).
 *
 * Faz 6.4/7.0/7.1a/9.1 davranışları korunuyor — UI client component'te.
 */
import { headers } from "next/headers";
import { isTenantAwareIdentityEnabled } from "@/platform/auth/tenant-identity";
import UyeOlClient from "./_components/UyeOlClient";

const BASE_TEXT = "Üye olmak istiyorum";

/** Tenant key → WA prefix. emlak'a (default) prefix YOK — eski davranış korunur. */
function buildWaText(tenantKey: string | null, flagOn: boolean): string {
  if (!flagOn) return BASE_TEXT;
  if (!tenantKey || tenantKey === "emlak") return BASE_TEXT;
  return `${tenantKey.toUpperCase()}: ${BASE_TEXT}`;
}

export default async function UyeOlPage() {
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const flagOn = isTenantAwareIdentityEnabled();
  const waText = buildWaText(tenantKey, flagOn);

  return <UyeOlClient waText={waText} />;
}
