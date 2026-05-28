/**
 * /api/profilduzenle/init?t=<token> — magic link doğrula + profilin
 * mevcut agent_profile alanlarını döndür (form pre-populate için).
 *
 * Not: /api/profil/init farklı bir endpoint (legacy onboarding) — bu
 * dosya emlakçının kişisel profil/web sayfası bilgilerini yönetmek için.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByDomain } from "@/tenants/config";

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
    // Defense-in-depth: bu endpoint emlak agent profilini (agent_profile +
    // web_slug) yönetir — diğer SaaS'larda anlamsız ve sızıntı yaratır.
    const host = req.headers.get("host") || "";
    const tenantKey = getTenantByDomain(host)?.key || null;
    if (tenantKey !== "emlak") {
      return NextResponse.json(
        { error: `Profil düzenleme yalnız emlak SaaS'ında aktif (tenant: ${tenantKey || "unknown"}).` },
        { status: 403 },
      );
    }

    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, phone, whatsapp_phone, metadata")
      .eq("id", auth.userId)
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
