/**
 * POST /api/profile/tour-complete
 *
 * Body: { tour_key: string }   — örn "bayi_panel"
 *
 * profile.metadata.tour_seen_at[tour_key] = ISO timestamp.
 * Idempotent: ikinci çağrıda timestamp güncellenir (yine "görüldü").
 *
 * Auth: requireAuth (cookie session öncelikli). Tour gösterilmesi için
 * kullanıcının zaten panele girmiş olması gerek.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

interface ReqBody {
  tour_key?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const tourKey = (body.tour_key ?? "").trim();
  if (!tourKey || !/^[a-z0-9_]+$/.test(tourKey)) {
    return NextResponse.json({ error: "bad_tour_key" }, { status: 400 });
  }

  const sb = getServiceClient();
  // session.uid profile.id'yi taşır; resolveTenantProfile gerek yok — kullanıcının
  // KENDİ profilini güncellediği için tenant filter zorunlu değil.
  const { data: prof } = await sb
    .from("profiles")
    .select("id, metadata")
    .eq("id", auth.userId)
    .maybeSingle();
  if (!prof) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  const meta = (prof.metadata as Record<string, unknown>) ?? {};
  const seen = (meta.tour_seen_at as Record<string, string> | undefined) ?? {};
  seen[tourKey] = new Date().toISOString();
  const newMeta = { ...meta, tour_seen_at: seen };

  const { error: updErr } = await sb
    .from("profiles")
    .update({ metadata: newMeta })
    .eq("id", prof.id);
  if (updErr) {
    console.error("[tour-complete] update failed", updErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tour_seen_at: seen[tourKey] });
}
