/**
 * /api/market/profil/init — market profil form için mevcut değerleri döndür.
 * Hem flat metadata keyleri (market_adi, sektor) hem yapılandırılmış
 * market_profili objesini okur — eski onboarding-flow.ts ile uyumlu.
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

  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", pt.user_id)
    .single();

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
