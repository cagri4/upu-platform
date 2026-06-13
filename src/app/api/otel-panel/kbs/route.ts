/**
 * /api/otel-panel/kbs — KBS submission list + create (Faz 3)
 *
 * GET: tüm submission'lar (rezervasyon adı + durum)
 * POST: bir reservation_id için yeni KBS gönderimi (mock client)
 *   body: { reservation_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { submitKbsMock, type KbsSubmissionPayload } from "@/platform/kbs/mock-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, submissions: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, submissions: [] });

  const { data: subs } = await sb
    .from("otel_kbs_submissions")
    .select("id, reservation_id, status, kbs_reference, is_mock, error_message, sent_at, accepted_at, rejected_at, created_at, otel_reservations(guest_name, check_in, check_out, otel_rooms(name))")
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, submissions: subs || [] });
}

interface PostBody {
  reservation_id?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.reservation_id) {
    return NextResponse.json({ error: "reservation_id zorunlu" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Rez + scope check
  const { data: rez } = await sb
    .from("otel_reservations")
    .select("id, hotel_id, guest_name, check_in, check_out, otel_rooms(name), otel_hotels(name)")
    .eq("id", body.reservation_id)
    .single();
  if (!rez) return NextResponse.json({ error: "Rezervasyon bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", rez.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  // Pre-check-in verilerinden kimlik bilgilerini topla
  const { data: pre } = await sb
    .from("otel_pre_checkins")
    .select("tc_no, birth_date, nationality, mother_name, father_name, id_type, id_number, gender")
    .eq("reservation_id", body.reservation_id)
    .maybeSingle();

  const payload: KbsSubmissionPayload = {
    guest: {
      guest_name: rez.guest_name,
      tc_no: pre?.tc_no || null,
      id_type: pre?.id_type || null,
      id_number: pre?.id_number || null,
      birth_date: pre?.birth_date || null,
      nationality: pre?.nationality || null,
      mother_name: pre?.mother_name || null,
      father_name: pre?.father_name || null,
      gender: pre?.gender || null,
    },
    stay: {
      room_name: (rez.otel_rooms as any)?.name || null,
      check_in: rez.check_in,
      check_out: rez.check_out,
    },
    hotel: {
      hotel_name: (rez.otel_hotels as any)?.name || "—",
      hotel_id: rez.hotel_id,
    },
  };

  // Pending kayıt
  const { data: sub, error: insErr } = await sb
    .from("otel_kbs_submissions")
    .insert({
      reservation_id: rez.id,
      hotel_id: rez.hotel_id,
      status: "pending",
      payload,
      is_mock: true,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Mock'a gönder
  const result = await submitKbsMock(payload);

  const now = new Date().toISOString();
  const updates: Record<string, any> = {
    status: result.status,
    kbs_reference: result.reference_no,
    kbs_response: result.raw_response,
    error_message: result.error_message,
    sent_at: now,
    updated_at: now,
  };
  if (result.status === "accepted") updates.accepted_at = now;
  if (result.status === "rejected") updates.rejected_at = now;

  await sb.from("otel_kbs_submissions").update(updates).eq("id", sub.id);

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: now })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({
    success: true,
    submission_id: sub.id,
    status: result.status,
    reference_no: result.reference_no,
    error_message: result.error_message,
    is_mock: true,
  });
}
