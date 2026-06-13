/**
 * /api/otel-panel/kbs/[id] — Yeniden gönder / sil (Faz 3)
 *
 * POST (action: "resubmit"): mock'a yeniden gönder (rejected/failed sonrası)
 * DELETE: pending durumunda iptal
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { submitKbsMock, type KbsSubmissionPayload } from "@/platform/kbs/mock-client";

export const dynamic = "force-dynamic";

async function scope(sb: any, userId: string, subId: string) {
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };

  const { data: sub } = await sb
    .from("otel_kbs_submissions")
    .select("id, hotel_id, reservation_id, status, payload")
    .eq("id", subId)
    .single();
  if (!sub) return { error: "Kayıt yok", status: 404 };

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", sub.hotel_id)
    .maybeSingle();
  if (!ouhRow) return { error: "Yetkisiz", status: 403 };
  return { sub };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await scope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  const sub = chk.sub;
  const result = await submitKbsMock(sub.payload as KbsSubmissionPayload);

  const now = new Date().toISOString();
  const updates: Record<string, any> = {
    status: result.status,
    kbs_reference: result.reference_no,
    kbs_response: result.raw_response,
    error_message: result.error_message,
    sent_at: now,
    updated_at: now,
  };
  if (result.status === "accepted") updates.accepted_at = now;
  if (result.status === "rejected") updates.rejected_at = now;

  await sb.from("otel_kbs_submissions").update(updates).eq("id", id);

  return NextResponse.json({
    success: true,
    status: result.status,
    reference_no: result.reference_no,
    error_message: result.error_message,
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await scope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  if (chk.sub.status === "accepted") {
    return NextResponse.json({ error: "Kabul edilmiş kayıt silinemez" }, { status: 409 });
  }

  const { error } = await sb.from("otel_kbs_submissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
