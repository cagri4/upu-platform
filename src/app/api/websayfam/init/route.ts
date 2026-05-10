/**
 * /api/websayfam/init?t=<token> — magic link doğrula, kullanıcının
 * web slug'ını ve aktif mülk sayısını döndür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

interface AgentProfile {
  full_name?: string;
  web_slug?: string;
  photo_url?: string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, metadata")
      .eq("id", auth.userId)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};
    const agent = (meta.agent_profile as AgentProfile) || {};

    const { count } = await supabase
      .from("emlak_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .eq("status", "aktif");

    if (!agent.web_slug) {
      return NextResponse.json({
        ready: false,
        message: "Önce profilinizi tamamlamanız gerekiyor.",
      });
    }

    return NextResponse.json({
      ready: true,
      slug: agent.web_slug,
      full_name: agent.full_name || profile?.display_name || "Emlak Danışmanı",
      photo_url: agent.photo_url || null,
      property_count: count || 0,
    });
  } catch (err) {
    console.error("[websayfam:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
