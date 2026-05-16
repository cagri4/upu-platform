/**
 * POST /api/panel/google-link/dismiss
 *
 * Welcome modal veya persistent banner dismiss eylemi. profiles.metadata
 * JSONB merge — diğer alanlar (agent_profile, about_cache, quick_actions
 * vb.) korunur. Multi-tenant aware lookup.
 *
 * Body:
 *   { type: "welcome", banner_dismissed_until?: string }
 *     → welcome_google_modal_seen = true
 *     → opsiyonel: google_banner_dismissed_until (genelde modal kapatılırken
 *       3 günlük grace tarihi set edilir)
 *
 *   { type: "banner", banner_dismissed_until: string }
 *     → google_banner_dismissed_until = <tarih>
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    type?: "welcome" | "banner";
    banner_dismissed_until?: string;
  };
  const type = body.type;
  const bannerUntil = body.banner_dismissed_until;

  if (type !== "welcome" && type !== "banner") {
    return NextResponse.json({ error: "Geçersiz type" }, { status: 400 });
  }

  // banner type için tarih zorunlu
  if (type === "banner" && !bannerUntil) {
    return NextResponse.json({ error: "banner_dismissed_until gerekli" }, { status: 400 });
  }

  const admin = getServiceClient();
  const lookup = await resolveTenantProfile<{
    metadata: Record<string, unknown> | null;
  }>(admin, {
    userId: auth.userId,
    select: "id, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const meta = lookup.profile.metadata ?? {};
  const nextMeta = { ...meta };

  if (type === "welcome") {
    nextMeta.welcome_google_modal_seen = true;
    if (bannerUntil) nextMeta.google_banner_dismissed_until = bannerUntil;
  } else {
    nextMeta.google_banner_dismissed_until = bannerUntil!;
  }

  const { error: writeErr } = await admin
    .from("profiles")
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
    .eq("id", lookup.profile.id);
  if (writeErr) {
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
