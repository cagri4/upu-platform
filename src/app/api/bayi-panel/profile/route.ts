/**
 * GET /api/bayi-panel/profile?t=<token>
 *
 * Bayi profilim özet — display_name + firma_profili snapshot.
 * Profilim sayfasında okunan veriyi tek seferde döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Cookie session öncelik, token fallback (dashboard endpoint ile aynı
  // pattern — token query client-side navigation sonrası düşebilir).
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata, phone")
    .eq("id", auth.userId)
    .maybeSingle();

  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;

  return NextResponse.json({
    success: true,
    displayName: profile?.display_name || null,
    phone: profile?.phone || null,
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
