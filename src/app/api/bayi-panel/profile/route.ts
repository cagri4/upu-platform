/**
 * GET /api/bayi-panel/profile?t=<token>
 *
 * Bayi profilim özet — display_name + firma_profili snapshot.
 * Profilim sayfasında okunan veriyi tek seferde döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata, phone")
    .eq("id", pt.user_id)
    .single();

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
