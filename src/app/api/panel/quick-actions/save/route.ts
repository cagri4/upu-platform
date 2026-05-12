/**
 * POST /api/panel/quick-actions/save
 *
 * Kullanıcının Panel Ayarları > Hızlı İşlemler tercihini kaydeder.
 * profiles.metadata.quick_actions = string[] (sırayla)
 *
 * Auth (cookie öncelikli, /api/panel/dashboard ile aynı pattern):
 *   1) Cookie session geçerse → uid
 *   2) Cookie yoksa + body.token varsa → magic link doğrula
 *   3) Aksi 401
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";
import { sanitizeQuickActions } from "@/platform/quick-actions/keys";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sb = getServiceClient();
  let userId: string | null = null;

  // 1) Cookie session öncelikli
  const session = await getSessionFromCookies();
  if (session?.uid) {
    userId = session.uid;
  } else {
    // 2) Token fallback (legacy WA URL'leri)
    const token = body?.token;
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
    }
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
    }
    userId = pt.user_id;
  }
  if (!userId) return NextResponse.json({ error: "Oturum çözülemedi" }, { status: 401 });

  // Body validation
  const actions = sanitizeQuickActions(body?.actions);
  if (actions === null) {
    return NextResponse.json({ error: "Geçersiz işlem listesi" }, { status: 400 });
  }

  // Metadata merge — diğer alanları (agent_profile, about_cache vb.) bozma
  const { data: prof, error: readErr } = await sb
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .single();
  if (readErr || !prof) {
    return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
  }
  const meta = (prof.metadata as Record<string, unknown> | null) || {};
  const nextMeta = { ...meta, quick_actions: actions };

  const { error: writeErr } = await sb
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", userId);
  if (writeErr) {
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }

  return NextResponse.json({ success: true, quickActions: actions });
}
