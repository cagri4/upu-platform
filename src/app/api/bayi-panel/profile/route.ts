/**
 * GET /api/bayi-panel/profile?t=<token>
 *
 * Bayi profilim özet — display_name + firma_profili snapshot.
 *
 * Multi-tenant fix: resolveTenantProfile("bayi") ile composite lookup.
 * Eski .eq("id", auth.userId) bayi multi-tenant profile'ında 0 row dönüyordu.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Cookie session öncelik, token fallback (dashboard endpoint ile aynı
  // pattern — token query client-side navigation sonrası düşebilir).
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    phone: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, display_name, metadata, phone",
  });

  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const meta = (lookup.profile.metadata || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;

  return NextResponse.json({
    success: true,
    displayName: lookup.profile.display_name || null,
    phone: lookup.profile.phone || null,
    firma: {
      ticari_unvan:    (firma.ticari_unvan as string) || null,
      yetkili_adi:     (firma.yetkili_adi as string) || null,
      ofis_telefon:    (firma.ofis_telefon as string) || null,
      ofis_adresi:     (firma.ofis_adresi as string) || null,
      sektor:          (firma.sektor as string) || null,
      email_kurumsal:  (firma.email_kurumsal as string) || null,
      web_sitesi:      (firma.web_sitesi as string) || null,
    },
  });
}
