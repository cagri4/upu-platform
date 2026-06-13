/**
 * /api/otel-panel/guest/[id] — Misafir profili + konaklama geçmişi (Faz 1G)
 *
 * GET: profil + lifetime stats (otel_guest_hotels rollup) + son rezervasyonlar
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Misafir profili (aynı tenant)
  const { data: guest } = await sb
    .from("profiles")
    .select("id, display_name, whatsapp_phone, metadata, created_at, tenant_id")
    .eq("id", id)
    .single();
  if (!guest || guest.tenant_id !== lookup.tenantId) {
    return NextResponse.json({ error: "Misafir bulunamadı" }, { status: 404 });
  }

  // Owner'ın hotel scope'u
  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);

  // Lifetime stats (otel_guest_hotels) — sahip olduğu otellerle eşleşen
  let lifetime: any[] = [];
  if (hotelIds.length > 0) {
    const { data } = await sb
      .from("otel_guest_hotels")
      .select("hotel_id, first_visit, last_visit, total_stays, total_spend, last_message_at")
      .eq("profile_id", id)
      .in("hotel_id", hotelIds);
    lifetime = data || [];
  }

  // Son rezervasyonlar (guest_profile_id veya guest_phone eşleşmesi)
  let reservations: any[] = [];
  if (hotelIds.length > 0) {
    const { data } = await sb
      .from("otel_reservations")
      .select("id, check_in, check_out, status, total_price, source, otel_rooms(name, room_type)")
      .in("hotel_id", hotelIds)
      .or(`guest_profile_id.eq.${id},guest_phone.eq.${guest.whatsapp_phone || "__none__"}`)
      .order("check_in", { ascending: false })
      .limit(50);
    reservations = data || [];
  }

  // Aggregate (her zaman pratik — guest_hotels boşsa rezervasyonlardan hesapla)
  const totalStays = lifetime.reduce((s, l) => s + (l.total_stays || 0), 0)
    || reservations.filter(r => r.status === "checked_out").length;
  const totalSpend = lifetime.reduce((s, l) => s + Number(l.total_spend || 0), 0)
    || reservations.filter(r => r.status === "checked_out").reduce((s, r) => s + Number(r.total_price || 0), 0);

  return NextResponse.json({
    success: true,
    guest: {
      id: guest.id,
      display_name: guest.display_name,
      whatsapp_phone: guest.whatsapp_phone,
      metadata: guest.metadata,
      created_at: guest.created_at,
    },
    stats: {
      total_stays: totalStays,
      total_spend: Math.round(totalSpend),
      lifetime_records: lifetime.length,
    },
    reservations,
  });
}
