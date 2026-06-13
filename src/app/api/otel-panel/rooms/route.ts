/**
 * /api/otel-panel/rooms — Web-side oda CRUD (Faz 1C)
 *
 * POST: yeni oda
 *   body: { name, room_type, bed_type?, max_occupancy?, base_price?, status?='clean' }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["clean", "dirty", "inspected", "out_of_order", "occupied"];

interface Body {
  name?: string;
  room_type?: string;
  bed_type?: string;
  max_occupancy?: number;
  base_price?: number;
  status?: string;
  hotel_id?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.name || !body.room_type) {
    return NextResponse.json({ error: "name ve room_type zorunlu" }, { status: 400 });
  }
  if (body.status && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Owner'ın hotel scope'u
  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ error: "Otel atanmamış" }, { status: 403 });

  // body.hotel_id yoksa ilk oteli kullan
  const hotelId = body.hotel_id && hotelIds.includes(body.hotel_id) ? body.hotel_id : hotelIds[0];

  // sort_order: mevcut max + 1
  const { data: maxRow } = await sb
    .from("otel_rooms")
    .select("sort_order")
    .eq("hotel_id", hotelId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order || 0) + 1;

  const { data: created, error } = await sb
    .from("otel_rooms")
    .insert({
      hotel_id: hotelId,
      name: body.name.trim(),
      room_type: body.room_type.trim(),
      bed_type: body.bed_type?.trim() || null,
      max_occupancy: body.max_occupancy || 2,
      base_price: body.base_price ?? null,
      status: body.status || "clean",
      sort_order: sortOrder,
    })
    .select("id, name, room_type, bed_type, max_occupancy, base_price, status, sort_order")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, room: created });
}
