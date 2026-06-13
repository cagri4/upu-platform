/**
 * /api/otel-panel/housekeeping/[id] — Housekeeping task status update (Faz 1D)
 *
 * PATCH body: { action: "start"|"complete", notes? }
 *   - start → status='in_progress'
 *   - complete → status='completed' + ilgili odanın status='clean' (otomatik)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ACTION_TO_STATUS: Record<string, string> = {
  start: "in_progress",
  complete: "completed",
  reopen: "pending",
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: task } = await sb
    .from("otel_housekeeping_tasks")
    .select("id, hotel_id, room_id, status")
    .eq("id", id)
    .single();
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", task.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const newStatus = body.action && ACTION_TO_STATUS[body.action];
  if (!newStatus) {
    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  }

  const updates: Record<string, any> = { status: newStatus };
  if (body.notes !== undefined) updates.notes = body.notes;

  const { error } = await sb
    .from("otel_housekeeping_tasks")
    .update(updates)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Side-effect: completed → odayı clean'e çevir
  if (body.action === "complete" && task.room_id) {
    await sb.from("otel_rooms").update({ status: "clean" }).eq("id", task.room_id);
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true });
}
