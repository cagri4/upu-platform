/**
 * /api/mulklerim/init — magic link doğrulama + kullanıcının
 * tüm aktif mülklerini listele (kart layout için).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, type, listing_type, price, area, rooms, location_neighborhood, location_district, image_url, status, created_at")
      .eq("user_id", magicToken.user_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(100);

    // İlk fotoğrafı emlak_property_photos tablosundan da çek (image_url null ise)
    const propIds = (properties || []).map(p => p.id);
    const { data: photos } = propIds.length > 0
      ? await supabase
          .from("emlak_property_photos")
          .select("property_id, url, sort_order")
          .in("property_id", propIds)
          .order("sort_order", { ascending: true })
      : { data: [] };

    const firstPhotoMap: Record<string, string> = {};
    for (const p of photos || []) {
      const pid = p.property_id as string;
      if (!firstPhotoMap[pid] && p.url) {
        firstPhotoMap[pid] = p.url as string;
      }
    }

    // Her mülk için en son oluşturulan sunum'un magic_token'ını çek
    const { data: presentations } = propIds.length > 0
      ? await supabase
          .from("emlak_presentations")
          .select("magic_token, property_ids, created_at")
          .neq("status", "deleted")
          .order("created_at", { ascending: false })
      : { data: [] };

    const latestSunumMap: Record<string, string> = {};
    for (const pres of presentations || []) {
      const pids = (pres.property_ids as string[] | null) || [];
      for (const pid of pids) {
        if (!latestSunumMap[pid] && pres.magic_token) {
          latestSunumMap[pid] = pres.magic_token as string;
        }
      }
    }

    const items = (properties || []).map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      listing_type: p.listing_type,
      price: p.price,
      area: p.area,
      rooms: p.rooms,
      location: p.location_neighborhood || p.location_district || null,
      cover: firstPhotoMap[p.id] || (p.image_url as string | null) || null,
      status: p.status,
      created_at: p.created_at,
      sunum_token: latestSunumMap[p.id] || null,
    }));

    return NextResponse.json({ properties: items });
  } catch (err) {
    console.error("[mulklerim:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
