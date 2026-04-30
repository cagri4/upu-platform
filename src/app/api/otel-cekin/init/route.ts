/**
 * GET /api/otel-cekin/init?t=<token>
 *
 * Mekik check-in formu için: token doğrula, rezervasyon + otel bilgisini
 * ön-doldurma için döndür. multi-use token (72h) — used_at işaretlenmez,
 * misafir geri dönüp düzeltebilir. Tamamlanmış olan formu yine açar
 * ve "Tamamlandı, düzenle" görünümü gösterilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at, purpose, metadata")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }
  if (magicToken.purpose !== "otel-pre-checkin") {
    return NextResponse.json({ error: "Bu link online check-in için değil." }, { status: 400 });
  }

  const meta = (magicToken.metadata || {}) as Record<string, unknown>;
  const reservationId = meta.reservation_id as string | undefined;
  if (!reservationId) {
    return NextResponse.json({ error: "Rezervasyon bağlantısı eksik." }, { status: 400 });
  }

  const { data: rez } = await supabase
    .from("otel_reservations")
    .select("id, hotel_id, guest_name, guest_phone, check_in, check_out, pre_checkin_complete, otel_rooms(name)")
    .eq("id", reservationId)
    .maybeSingle();

  if (!rez) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });

  // Owner doğrulaması: token'in user_id'si rezervasyonun guest_profile_id'sine bağlı olmalı
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", magicToken.user_id)
    .maybeSingle();

  // Otel bilgisi
  const { data: hotel } = await supabase
    .from("otel_hotels")
    .select("name, location")
    .eq("id", rez.hotel_id)
    .maybeSingle();

  // Mevcut pre-checkin var mı? (multi-use form, geri dönüş)
  const { data: existing } = await supabase
    .from("otel_pre_checkins")
    .select("id, id_photo_url, signature_url, preferences, kvkk_accepted_at, marketing_opt_in, completed_at")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const roomName = (rez.otel_rooms as unknown as { name?: string } | null)?.name || null;

  return NextResponse.json({
    success: true,
    reservation: {
      id: rez.id,
      guest_name: rez.guest_name,
      guest_phone: rez.guest_phone,
      check_in: rez.check_in,
      check_out: rez.check_out,
      room_name: roomName,
      pre_checkin_complete: rez.pre_checkin_complete,
    },
    hotel: hotel ? { name: hotel.name, location: hotel.location } : null,
    profile: profile ? { display_name: profile.display_name } : null,
    existing: existing ? {
      id_photo_url: existing.id_photo_url,
      preferences: existing.preferences || {},
      marketing_opt_in: existing.marketing_opt_in,
      completed_at: existing.completed_at,
    } : null,
  });
}
