/**
 * /[locale]/giris — Server wrapper.
 *
 * Tenant'a göre header brand adı hesaplar (Bug fix: retailai/marketai/...
 * subdomain'lerinde "UPU Emlak" yerine doğru tenant adı görünsün).
 */
import { headers } from "next/headers";
import { getTenantBrandShort } from "@/platform/tenants/brand";
import GirisClient from "./_components/GirisClient";

export default async function GirisPage() {
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const brandName = getTenantBrandShort(tenantKey);
  return <GirisClient brandName={brandName} />;
}
