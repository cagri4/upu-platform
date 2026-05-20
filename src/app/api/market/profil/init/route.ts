/**
 * /api/market/profil/init — market profil form için mevcut değerleri döndür.
 * Hem flat metadata keyleri (market_adi, sektor) hem yapılandırılmış
 * market_profili objesini okur — eski onboarding-flow.ts ile uyumlu.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null; metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "market",
    select: "display_name, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;
  const meta = (profile?.metadata as Record<string, unknown>) || {};
  const mp = (meta.market_profili as Record<string, unknown>) || {};

  // Yapılandırılmış obje öncelikli, flat key fallback (eski profiller için)
  return NextResponse.json({
    success: true,
    displayName: profile?.display_name || null,
    marketAdi: (mp.market_adi as string) || (meta.market_adi as string) || null,
    sektor: (mp.sektor as string) || (meta.sektor as string) || null,
    urunSayisi: (mp.urun_sayisi as string) || (meta.urun_sayisi as string) || null,
    adres: (mp.adres as string) || null,
    briefingEnabled: (mp.briefing_enabled as boolean) ?? (meta.briefing_enabled as boolean) ?? true,
  });
}
