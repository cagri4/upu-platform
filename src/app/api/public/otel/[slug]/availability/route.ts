/**
 * /api/public/otel/[slug]/availability — Tarih aralığı için boş odalar + fiyat
 *
 * Query: check_in (ISO date), check_out (ISO date), guests? (default 1)
 *
 * Akış:
 *   1. Hotel slug + web_published kontrol
 *   2. Hotel'in tüm aktif odalarını çek
 *   3. Tarih aralığında çakışan rezervasyonları sayıp, hangi odaların boş olduğunu bul
 *   4. Her boş oda için otel_calculate_total_price() ile toplam fiyatı hesapla
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return NextResponse.json({ error: "slug eksik" }, { status: 400 });

  const checkIn = req.nextUrl.searchParams.get("check_in");
  const checkOut = req.nextUrl.searchParams.get("check_out");
  const guests = Number(req.nextUrl.searchParams.get("guests") || "1");

  if (!checkIn || !checkOut) {
    return NextResponse.json({ error: "check_in ve check_out zorunlu" }, { status: 400 });
  }
  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json({ error: "Çıkış tarihi giriş tarihinden sonra olmalı" }, { status: 400 });
  }
  if (new Date(checkIn) < new Date(new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Geçmiş tarih seçilemez" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, slug, web_published")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();
  if (!hotel) return NextResponse.json({ error: "Otel bulunamadı" }, { status: 404 });

  const { data: rooms } = await sb
    .from("otel_rooms")
    .select("id, name, room_type, bed_type, max_occupancy, base_price")
    .eq("hotel_id", hotel.id)
    .neq("status", "out_of_order")
    .gte("max_occupancy", guests)
    .order("sort_order", { ascending: true });

  const allRooms = rooms || [];

  // Çakışan rezervasyonları çek
  const { data: conflictingRezs } = await sb
    .from("otel_reservations")
    .select("room_id")
    .eq("hotel_id", hotel.id)
    .in("status", ["confirmed", "checked_in", "pending"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  const bookedRoomIds = new Set((conflictingRezs || []).map((r: any) => r.room_id));
  const availableRooms = allRooms.filter(r => !bookedRoomIds.has(r.id));

  // Her oda için toplam fiyat hesapla
  const withPrice = await Promise.all(availableRooms.map(async (r) => {
    const { data: total } = await sb.rpc("otel_calculate_total_price", {
      p_room_id: r.id,
      p_check_in: checkIn,
      p_check_out: checkOut,
    });
    const nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    const totalPrice = Number(total) || (Number(r.base_price) || 0) * nights;
    return {
      id: r.id,
      name: r.name,
      room_type: r.room_type,
      bed_type: r.bed_type,
      max_occupancy: r.max_occupancy,
      nights,
      total_price: Math.round(totalPrice),
      avg_per_night: Math.round(totalPrice / Math.max(1, nights)),
    };
  }));

  // Oda tipine göre grupla (booking widget'ta tipler gösterilir; her tipte 1 örnek + sayı)
  const byType = new Map<string, { room_type: string; min_price: number; count: number; sample_room_id: string; bed_type: string | null; max_occupancy: number; nights: number }>();
  for (const r of withPrice) {
    const existing = byType.get(r.room_type);
    if (!existing || r.total_price < existing.min_price) {
      byType.set(r.room_type, {
        room_type: r.room_type,
        min_price: r.total_price,
        count: (existing?.count || 0) + 1,
        sample_room_id: existing && existing.min_price <= r.total_price ? existing.sample_room_id : r.id,
        bed_type: r.bed_type,
        max_occupancy: r.max_occupancy,
        nights: r.nights,
      });
    } else {
      existing.count += 1;
    }
  }

  return NextResponse.json({
    success: true,
    check_in: checkIn,
    check_out: checkOut,
    guests,
    nights: Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
    available_count: availableRooms.length,
    rooms: withPrice,
    by_type: Array.from(byType.values()),
  });
}
