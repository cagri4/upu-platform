/**
 * /api/otel-panel/reservations — Web-side rezervasyon CRUD (Faz 1B)
 *
 * POST: yeni rez (müsaitlik check + auto total_price)
 *   body: { room_id, guest_name, guest_phone?, check_in, check_out,
 *           status?='pending', source?='manual', total_price? }
 *
 * PATCH /[id] route'ta — status değişimi + alan güncelleme.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

interface Body {
  room_id?: string;
  guest_name?: string;
  guest_phone?: string;
  check_in?: string;
  check_out?: string;
  status?: string;
  source?: string;
  total_price?: number;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.room_id || !body.guest_name || !body.check_in || !body.check_out) {
    return NextResponse.json({ error: "room_id, guest_name, check_in, check_out zorunlu" }, { status: 400 });
  }
  if (new Date(body.check_out) <= new Date(body.check_in)) {
    return NextResponse.json({ error: "Çıkış tarihi giriş tarihinden sonra olmalı" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Oda + scope check
  const { data: room } = await sb
    .from("otel_rooms")
    .select("id, hotel_id, name, base_price")
    .eq("id", body.room_id)
    .single();
  if (!room) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", room.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Bu otele yetkiniz yok" }, { status: 403 });

  // Müsaitlik check (RPC)
  const { data: available, error: availErr } = await sb.rpc("otel_check_room_availability", {
    p_room_id: body.room_id,
    p_check_in: body.check_in,
    p_check_out: body.check_out,
    p_exclude_reservation_id: null,
  });
  if (availErr) {
    return NextResponse.json({ error: "Müsaitlik kontrolü başarısız: " + availErr.message }, { status: 500 });
  }
  if (available === false) {
    return NextResponse.json({ error: "Seçilen tarihlerde oda zaten dolu" }, { status: 409 });
  }

  // Auto price (price_calendar veya base_price)
  let totalPrice = body.total_price;
  if (totalPrice == null) {
    const { data: calc } = await sb.rpc("otel_calculate_total_price", {
      p_room_id: body.room_id,
      p_check_in: body.check_in,
      p_check_out: body.check_out,
    });
    totalPrice = Number(calc) || 0;
  }

  const { data: created, error: insErr } = await sb
    .from("otel_reservations")
    .insert({
      hotel_id: room.hotel_id,
      room_id: body.room_id,
      guest_name: body.guest_name.trim(),
      guest_phone: body.guest_phone?.trim() || null,
      check_in: body.check_in,
      check_out: body.check_out,
      status: body.status || "pending",
      source: body.source || "manual",
      total_price: totalPrice,
      pre_checkin_complete: false,
    })
    .select("id, guest_name, check_in, check_out, status, total_price")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, reservation: created });
}
