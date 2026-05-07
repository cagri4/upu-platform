/**
 * /api/panel/web-sitem?t=<panel_token>
 * Sidebar "Web Sitem" tıklamasında çağrılır. Token'ı doğrular,
 * profile.metadata.agent_profile.web_slug'a bakar:
 *   - varsa: /u/<slug>'a 302
 *   - yoksa: /tr/profil-duzenle'ye 302 (yeni magic-link mint ile)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.redirect(`${APP_URL}/tr/panel`);

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pt || new Date(pt.expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/tr/panel`);
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("metadata")
    .eq("id", pt.user_id)
    .single();

  const meta = (profile?.metadata as Record<string, unknown> | null) || {};
  const agent = (meta.agent_profile as { web_slug?: string } | undefined);
  const slug = agent?.web_slug || "";

  if (slug) {
    return NextResponse.redirect(`${APP_URL}/u/${slug}`);
  }

  // Slug yoksa profil-duzenle'ye fresh token ile yönlendir
  const newToken = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({ user_id: pt.user_id, token: newToken, expires_at: expires });
  return NextResponse.redirect(`${APP_URL}/tr/profil-duzenle?t=${newToken}`);
}
