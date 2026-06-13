/**
 * /api/otel-panel/price-calendar — Fiyat takvimi yönetimi (Faz 1E)
 *
 * GET ?start=YYYY-MM-DD&days=30 → mevcut fiyat override'ları + oda tipleri
 * POST body: { room_type, date, price, season_label? } → upsert
 * DELETE ?id=... → bir override sil
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, entries: [], roomTypes: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, entries: [], roomTypes: [] });

  const startParam = req.nextUrl.searchParams.get("start");
  const start = startParam ? new Date(startParam) : new Date();
  start.setHours(0, 0, 0, 0);
  const days = Number(req.nextUrl.searchParams.get("days") || "30");
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + days);

  const [entriesRes, roomsRes] = await Promise.all([
    sb.from("otel_price_calendar")
      .select("id, hotel_id, room_type, date, price, season_label")
      .in("hotel_id", hotelIds)
      .gte("date", start.toISOString().slice(0, 10))
      .lt("date", endDate.toISOString().slice(0, 10))
      .order("date", { ascending: true }),
    sb.from("otel_rooms")
      .select("room_type, base_price")
      .in("hotel_id", hotelIds),
  ]);

  // Distinct oda tipleri + her birinin base_price (örnek)
  const roomTypeMap = new Map<string, number | null>();
  for (const r of roomsRes.data || []) {
    if (!roomTypeMap.has(r.room_type)) roomTypeMap.set(r.room_type, r.base_price);
  }
  const roomTypes = Array.from(roomTypeMap.entries()).map(([k, v]) => ({ room_type: k, base_price: v }));

  return NextResponse.json({
    success: true,
    entries: entriesRes.data || [],
    roomTypes,
    start: start.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  });
}

interface PostBody {
  room_type?: string;
  date?: string;
  price?: number;
  season_label?: string;
  hotel_id?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.room_type || !body.date || body.price == null) {
    return NextResponse.json({ error: "room_type, date, price zorunlu" }, { status: 400 });
  }
  if (body.price < 0) {
    return NextResponse.json({ error: "Fiyat negatif olamaz" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ error: "Otel atanmamış" }, { status: 403 });

  const hotelId = body.hotel_id && hotelIds.includes(body.hotel_id) ? body.hotel_id : hotelIds[0];

  const { data: upserted, error } = await sb
    .from("otel_price_calendar")
    .upsert({
      hotel_id: hotelId,
      room_type: body.room_type,
      date: body.date,
      price: body.price,
      season_label: body.season_label || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "hotel_id,room_type,date" })
    .select("id, room_type, date, price, season_label")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, entry: upserted });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param zorunlu" }, { status: 400 });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: entry } = await sb
    .from("otel_price_calendar")
    .select("id, hotel_id")
    .eq("id", id)
    .single();
  if (!entry) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", entry.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { error } = await sb.from("otel_price_calendar").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
