/**
 * /api/otel-panel/reservations/[id] — durum değişimi + güncelleme (Faz 1B)
 *
 * PATCH body: { action?: "check_in"|"check_out"|"cancel"|"confirm",
 *               check_in?, check_out?, guest_name?, guest_phone?, total_price? }
 *
 * Action varsa status değişir + side-effect (örn. check_in → room.status='occupied').
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ACTION_TO_STATUS: Record<string, string> = {
  confirm: "confirmed",
  check_in: "checked_in",
  check_out: "checked_out",
  cancel: "cancelled",
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Rez + scope check
  const { data: rez } = await sb
    .from("otel_reservations")
    .select("id, hotel_id, room_id, status, check_in, check_out")
    .eq("id", id)
    .single();
  if (!rez) return NextResponse.json({ error: "Rezervasyon bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", rez.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Bu otele yetkiniz yok" }, { status: 403 });

  const updates: Record<string, any> = {};

  if (body.action && ACTION_TO_STATUS[body.action]) {
    updates.status = ACTION_TO_STATUS[body.action];
  }
  for (const f of ["guest_name", "guest_phone", "check_in", "check_out", "total_price"]) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  // Eğer tarih değiştiyse müsaitlik tekrar kontrol
  if (updates.check_in || updates.check_out) {
    const newIn = updates.check_in || rez.check_in;
    const newOut = updates.check_out || rez.check_out;
    if (new Date(newOut) <= new Date(newIn)) {
      return NextResponse.json({ error: "Çıkış tarihi giriş tarihinden sonra olmalı" }, { status: 400 });
    }
    const { data: available } = await sb.rpc("otel_check_room_availability", {
      p_room_id: rez.room_id,
      p_check_in: newIn,
      p_check_out: newOut,
      p_exclude_reservation_id: rez.id,
    });
    if (available === false) {
      return NextResponse.json({ error: "Seçilen tarihlerde oda dolu" }, { status: 409 });
    }
  }

  const { data: updated, error } = await sb
    .from("otel_reservations")
    .update(updates)
    .eq("id", id)
    .select("id, guest_name, check_in, check_out, status, total_price")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Side-effect: check_in → odayı occupied, check_out → odayı dirty
  if (body.action === "check_in") {
    await sb.from("otel_rooms").update({ status: "occupied" }).eq("id", rez.room_id);
  } else if (body.action === "check_out") {
    await sb.from("otel_rooms").update({ status: "dirty" }).eq("id", rez.room_id);
    // Otomatik housekeeping task
    try {
      await sb.from("otel_housekeeping_tasks").insert({
        hotel_id: rez.hotel_id,
        room_id: rez.room_id,
        task_type: "check_out_clean",
        priority: 1,
        status: "pending",
        queue_date: new Date().toISOString().slice(0, 10),
      });
    } catch {
      // silent — housekeeping auto-task best-effort
    }
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, reservation: updated });
}
