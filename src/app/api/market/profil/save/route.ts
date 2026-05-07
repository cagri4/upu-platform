/**
 * /api/market/profil/save — market profil form save endpoint.
 * Token doğrula → profile.metadata.market_profili'na merge.
 * Eski onboarding-flow.ts metadata'sıyla uyumlu (market_adi, sektor,
 * urun_sayisi, briefing_enabled gibi flat keyler de korunur).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface MarketProfilBody {
  token: string;
  market_adi?: string;
  sektor?: string;
  urun_sayisi?: string;
  adres?: string;
  briefing_enabled?: boolean;
  display_name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MarketProfilBody;
    if (!body?.token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const sb = getServiceClient();
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", body.token)
      .maybeSingle();

    if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("metadata")
      .eq("id", pt.user_id)
      .single();

    const meta = (profile?.metadata as Record<string, unknown>) || {};
    const newMeta = {
      ...meta,
      // Flat keyler — onboarding-flow.ts ile uyumlu
      market_adi: body.market_adi ?? meta.market_adi ?? null,
      sektor: body.sektor ?? meta.sektor ?? null,
      urun_sayisi: body.urun_sayisi ?? meta.urun_sayisi ?? null,
      briefing_enabled: body.briefing_enabled ?? meta.briefing_enabled ?? false,
      // Yapılandırılmış obje — yeni alanlar burada toplanır
      market_profili: {
        ...((meta.market_profili as Record<string, unknown>) || {}),
        market_adi: body.market_adi ?? null,
        sektor: body.sektor ?? null,
        urun_sayisi: body.urun_sayisi ?? null,
        adres: body.adres ?? null,
        briefing_enabled: body.briefing_enabled ?? false,
      },
      market_profili_completed: true,
    };

    const updateFields: Record<string, unknown> = { metadata: newMeta };
    if (body.display_name && body.display_name.trim()) {
      updateFields.display_name = body.display_name.trim();
    }

    const { error } = await sb
      .from("profiles")
      .update(updateFields)
      .eq("id", pt.user_id);

    if (error) {
      console.error("[market:profil:save]", error);
      return NextResponse.json({ error: "Profil kaydedilemedi" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[market:profil:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 });
  }
}
