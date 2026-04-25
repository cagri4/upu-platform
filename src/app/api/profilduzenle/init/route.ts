/**
 * /api/profilduzenle/init?t=<token> — magic link doğrula + profilin
 * mevcut agent_profile alanlarını döndür (form pre-populate için).
 *
 * Not: /api/profil/init farklı bir endpoint (legacy onboarding) — bu
 * dosya emlakçının kişisel profil/web sayfası bilgilerini yönetmek için.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface AgentProfile {
  full_name?: string;
  phone?: string;
  email?: string;
  office_address?: string;
  photo_url?: string;
  years_experience?: number;
  bio?: string;
  web_slug?: string;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, phone, whatsapp_phone, metadata")
      .eq("id", magicToken.user_id)
      .single();

    const meta = (profile?.metadata as Record<string, unknown> | null) || {};
    const agent = (meta.agent_profile as AgentProfile) || {};

    return NextResponse.json({
      profile: {
        full_name: agent.full_name || profile?.display_name || "",
        phone: agent.phone || (profile?.phone as string) || (profile?.whatsapp_phone as string) || "",
        email: agent.email || (profile?.email as string) || "",
        office_address: agent.office_address || "",
        photo_url: agent.photo_url || "",
        years_experience: agent.years_experience || null,
        bio: agent.bio || "",
        web_slug: agent.web_slug || "",
      },
    });
  } catch (err) {
    console.error("[profilduzenle:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
