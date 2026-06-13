/**
 * /api/public/otel/[slug]/book — Public rezervasyon oluştur (Faz 2)
 *
 * Auth YOK. Anonim misafir rezervasyon talep eder.
 *
 * Body: { room_id, guest_name, guest_phone, guest_email?,
 *          check_in, check_out, guests, notes?, kvkk_accepted: true }
 *
 * Çıktı: status='pending', sahibi onaylayana kadar bekler.
 * Müsaitlik tekrar kontrol (race condition guard).
 * Sahibine bildirim — best effort (send-notification).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface BookBody {
  room_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  notes?: string;
  kvkk_accepted?: boolean;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body: BookBody = await req.json().catch(() => ({}));

  if (!body.room_id || !body.guest_name || !body.guest_phone || !body.check_in || !body.check_out) {
    return NextResponse.json({ error: "room_id, guest_name, guest_phone, check_in, check_out zorunlu" }, { status: 400 });
  }
  if (!body.kvkk_accepted) {
    return NextResponse.json({ error: "KVKK onayı zorunlu" }, { status: 400 });
  }
  if (new Date(body.check_out) <= new Date(body.check_in)) {
    return NextResponse.json({ error: "Çıkış tarihi giriş tarihinden sonra olmalı" }, { status: 400 });
  }
  if (new Date(body.check_in) < new Date(new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Geçmiş tarih seçilemez" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, web_published, tenant_id")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();
  if (!hotel) return NextResponse.json({ error: "Otel bulunamadı" }, { status: 404 });

  // Oda bu otele mi ait?
  const { data: room } = await sb
    .from("otel_rooms")
    .select("id, hotel_id, room_type, name, base_price, max_occupancy")
    .eq("id", body.room_id)
    .eq("hotel_id", hotel.id)
    .single();
  if (!room) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });
  if (body.guests && body.guests > (room.max_occupancy || 2)) {
    return NextResponse.json({ error: "Oda kapasitesi yetersiz" }, { status: 400 });
  }

  // Müsaitlik kontrol (RPC) — race condition guard
  const { data: available } = await sb.rpc("otel_check_room_availability", {
    p_room_id: room.id,
    p_check_in: body.check_in,
    p_check_out: body.check_out,
    p_exclude_reservation_id: null,
  });
  if (available === false) {
    return NextResponse.json({ error: "Bu oda artık müsait değil" }, { status: 409 });
  }

  // Toplam fiyat
  const { data: priceCalc } = await sb.rpc("otel_calculate_total_price", {
    p_room_id: room.id,
    p_check_in: body.check_in,
    p_check_out: body.check_out,
  });
  const totalPrice = Number(priceCalc) || 0;

  // Rezervasyon kaydı (pending)
  const { data: created, error } = await sb
    .from("otel_reservations")
    .insert({
      hotel_id: hotel.id,
      room_id: room.id,
      guest_name: body.guest_name.trim(),
      guest_phone: body.guest_phone.trim(),
      check_in: body.check_in,
      check_out: body.check_out,
      status: "pending",
      source: "direct_web",
      total_price: totalPrice,
      pre_checkin_complete: false,
      notes: [
        body.guest_email ? `Email: ${body.guest_email.trim()}` : null,
        body.guests ? `Misafir: ${body.guests}` : null,
        body.notes?.trim() || null,
      ].filter(Boolean).join("\n") || null,
    })
    .select("id, guest_name, check_in, check_out, total_price")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sahibe bildirim — best effort (otel sahibi profillerini bul)
  try {
    const { data: owners } = await sb
      .from("otel_user_hotels")
      .select("user_id")
      .eq("hotel_id", hotel.id);
    for (const o of owners || []) {
      // Sadece DB notification log + WA aware (24h window send-notification handler'ı)
      try {
        const { sendNotification } = await import("@/platform/notifications/send-notification");
        await sendNotification({
          userId: o.user_id,
          type: "reservation_new" as any,
          title: "Yeni Rezervasyon Talebi",
          body: `${body.guest_name} ${body.check_in} → ${body.check_out} (${room.name}) — ${Math.round(totalPrice)} TL`,
          payload: {
            click_target: `/tr/otel-rezervasyonlar`,
            related_entity_id: created!.id,
            related_entity_type: "reservation",
          },
        });
      } catch {
        // notification handler yoksa sessizce geç
      }
    }
  } catch {
    // best effort
  }

  return NextResponse.json({
    success: true,
    reservation_id: created!.id,
    status: "pending",
    message: "Talebiniz alındı. Otel sizi onay için arayacak.",
  });
}
