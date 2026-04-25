/**
 * /api/mulklerim/update — mevcut mülkün alanlarını güncelle.
 * Foto eklenirse emlak_property_photos'a yeni satırlar atılır,
 * silinen URL'ler tablodan kaldırılır.
 *
 * POST { token, id, ...form_fields, photo_urls }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function toArr(v: unknown): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(x => typeof x === "string" && x.trim()).map(x => String(x).trim());
  const s = String(v).trim();
  if (!s) return null;
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const id = body.id as string;
    if (!token || !id) {
      return NextResponse.json({ error: "Token ve id gerekli." }, { status: 400 });
    }

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

    if (!body.title || String(body.title).trim().length < 3) {
      return NextResponse.json({ error: "Başlık en az 3 karakter olmalı." }, { status: 400 });
    }
    if (!body.price || Number(body.price) <= 0) {
      return NextResponse.json({ error: "Geçerli fiyat gerekli." }, { status: 400 });
    }

    const photoUrls: string[] = Array.isArray(body.photo_urls)
      ? body.photo_urls.filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http")).slice(0, 15)
      : [];

    // Property güncelle
    const { error: updErr } = await supabase
      .from("emlak_properties")
      .update({
        title: String(body.title).trim(),
        listing_type: body.listing_type || "satilik",
        type: body.type || "daire",
        price: Number(body.price),
        area: body.area ? Number(body.area) : null,
        net_area: body.net_area ? Number(body.net_area) : null,
        rooms: body.rooms || null,
        floor: body.floor || null,
        total_floors: body.total_floors || null,
        building_age: body.building_age || null,
        location_city: body.location_city || null,
        location_district: body.location_district || null,
        location_neighborhood: body.location_neighborhood || null,
        heating: body.heating || null,
        parking: body.parking || null,
        facade: toArr(body.facade),
        housing_type: toArr(body.housing_type),
        bathroom_count: body.bathroom_count || null,
        kitchen_type: body.kitchen_type || null,
        elevator: typeof body.elevator === "boolean" ? body.elevator : null,
        balcony: typeof body.balcony === "boolean" ? body.balcony : null,
        deed_type: body.deed_type || null,
        usage_status: body.usage_status || null,
        swap: typeof body.swap === "boolean" ? body.swap : null,
        description: body.description || null,
        image_url: photoUrls[0] || null,
      })
      .eq("id", id)
      .eq("user_id", magicToken.user_id);

    if (updErr) {
      console.error("[mulklerim:update]", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Photos'ı sync et: mevcut URL listesini al, fark olanları DELETE et + yeni olanları INSERT
    const { data: existingPhotos } = await supabase
      .from("emlak_property_photos")
      .select("id, url")
      .eq("property_id", id);

    const existingUrls = new Set((existingPhotos || []).map(p => p.url as string));
    const incomingUrls = new Set(photoUrls);

    // Sil: mevcut'ta var, gelende yok
    const toDeleteIds = (existingPhotos || [])
      .filter(p => !incomingUrls.has(p.url as string))
      .map(p => p.id);
    if (toDeleteIds.length > 0) {
      await supabase.from("emlak_property_photos").delete().in("id", toDeleteIds);
    }

    // Ekle: gelende var, mevcut'ta yok
    const toInsert = photoUrls
      .filter(u => !existingUrls.has(u))
      .map((u, idx) => ({
        property_id: id,
        user_id: magicToken.user_id,
        url: u,
        sort_order: idx + 1,
      }));
    if (toInsert.length > 0) {
      await supabase.from("emlak_property_photos").insert(toInsert);
    }

    // sort_order'ı yeniden düzenle (hepsini güncelle)
    if (photoUrls.length > 0) {
      for (let i = 0; i < photoUrls.length; i++) {
        await supabase
          .from("emlak_property_photos")
          .update({ sort_order: i + 1 })
          .eq("property_id", id)
          .eq("url", photoUrls[i]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mulklerim:update]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
