/**
 * /api/otel-panel/rooms/[id] — Oda güncelle / sil (Faz 1C)
 *
 * PATCH body: { name?, room_type?, bed_type?, max_occupancy?, base_price?, status?, sort_order? }
 * DELETE: ileriye dönük rezervasyon yoksa sil
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody, requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["clean", "dirty", "inspected", "out_of_order", "occupied"];

async function checkScope(sb: any, userId: string, roomId: string) {
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };

  const { data: room } = await sb
    .from("otel_rooms")
    .select("id, hotel_id")
    .eq("id", roomId)
    .single();
  if (!room) return { error: "Oda bulunamadı", status: 404 };

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", room.hotel_id)
    .maybeSingle();
  if (!ouhRow) return { error: "Bu otele yetkiniz yok", status: 403 };

  return { room };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await checkScope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  const updates: Record<string, any> = {};
  for (const f of ["name", "room_type", "bed_type", "max_occupancy", "base_price", "sort_order"]) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const { data: updated, error } = await sb
    .from("otel_rooms")
    .update(updates)
    .eq("id", id)
    .select("id, name, room_type, bed_type, max_occupancy, base_price, status, sort_order")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, room: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await checkScope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  const today = new Date().toISOString().slice(0, 10);
  const { count } = await sb
    .from("otel_reservations")
    .select("*", { count: "exact", head: true })
    .eq("room_id", id)
    .gte("check_out", today)
    .neq("status", "cancelled");
  if ((count || 0) > 0) {
    return NextResponse.json({ error: "Bu odaya bağlı aktif/gelecek rezervasyon var. Önce iptal edin." }, { status: 409 });
  }

  const { error } = await sb.from("otel_rooms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
