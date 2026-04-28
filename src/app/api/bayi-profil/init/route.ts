/**
 * GET /api/bayi-profil/init — validate token and return current firma
 * profili (if any) so the form can pre-fill. New owners come in fresh
 * from onboarding, so company_name + display_name come from metadata
 * onboarding answers.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 500 });

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;

  return NextResponse.json({
    success: true,
    callerName: profile.display_name || null,
    onboardingCompanyName: (meta.company_name as string) || null,
    firma: {
      ticari_unvan: (firma.ticari_unvan as string) || (meta.company_name as string) || "",
      yetkili_adi: (firma.yetkili_adi as string) || profile.display_name || "",
      ofis_telefon: (firma.ofis_telefon as string) || "",
      ofis_adresi: (firma.ofis_adresi as string) || "",
      sektor: (firma.sektor as string) || "",
      vergi_dairesi: (firma.vergi_dairesi as string) || "",
      vergi_no: (firma.vergi_no as string) || "",
      kurulus_yili: (firma.kurulus_yili as string) || "",
      email_kurumsal: (firma.email_kurumsal as string) || "",
      web_sitesi: (firma.web_sitesi as string) || "",
      iban: (firma.iban as string) || "",
      banka: (firma.banka as string) || "",
      hesap_sahibi: (firma.hesap_sahibi as string) || "",
      tanitim: (firma.tanitim as string) || "",
    },
  });
}
