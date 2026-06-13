/**
 * /api/public/otel/[slug] — Public otel detayı (Faz 2)
 *
 * Auth YOK. Sadece web_published=true otelleri okur.
 * Çıktı: hotel + rooms (sort_order'lı) + room_types (distinct).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return NextResponse.json({ error: "slug eksik" }, { status: 400 });

  const sb = getServiceClient();
  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, public_settings, web_published, metadata")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();

  if (!hotel) return NextResponse.json({ error: "Otel bulunamadı" }, { status: 404 });

  const { data: rooms } = await sb
    .from("otel_rooms")
    .select("id, name, room_type, bed_type, max_occupancy, base_price")
    .eq("hotel_id", hotel.id)
    .neq("status", "out_of_order")
    .order("sort_order", { ascending: true });

  // Distinct room types + min price
  const typeMap = new Map<string, { room_type: string; min_price: number; max_occupancy: number; count: number; bed_type: string | null }>();
  for (const r of rooms || []) {
    const existing = typeMap.get(r.room_type);
    if (!existing) {
      typeMap.set(r.room_type, {
        room_type: r.room_type,
        min_price: Number(r.base_price) || 0,
        max_occupancy: r.max_occupancy || 2,
        count: 1,
        bed_type: r.bed_type,
      });
    } else {
      existing.count += 1;
      if (r.base_price && Number(r.base_price) < existing.min_price) {
        existing.min_price = Number(r.base_price);
      }
      if (r.max_occupancy && r.max_occupancy > existing.max_occupancy) {
        existing.max_occupancy = r.max_occupancy;
      }
    }
  }

  return NextResponse.json({
    success: true,
    hotel: {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      ...hotel.public_settings,
    },
    room_types: Array.from(typeMap.values()),
    total_rooms: rooms?.length || 0,
  });
}
