/**
 * GET   /api/saha/visits/[id] — ziyaret detayı (+bayi + alınan siparişler).
 * PATCH /api/saha/visits/[id] — not/foto/GPS güncelle veya check-out.
 *   body: { note?, photo_url?, gps_lat?, gps_lng?, check_out?: true }
 *
 * check_out=true: status='completed', check_out_at=now + ilişkili plan
 * 'done' işaretlenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../../_auth";

export const dynamic = "force-dynamic";

const GPS_LAT_MAX = 90;
const GPS_LNG_MAX = 180;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId } = auth;
  const { id } = await params;

  const { data: visit } = await sb
    .from("bayi_visits")
    .select("id, dealer_id, plan_id, status, check_in_at, check_out_at, gps_lat, gps_lng, photo_url, note, bayi_dealers(name, company_name, address)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .eq("id", id)
    .maybeSingle();
  if (!visit) return NextResponse.json({ error: "Ziyaret bulunamadı." }, { status: 404 });

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  // Bu ziyarette alınan siparişler
  const { data: vorders } = await sb
    .from("bayi_visit_orders")
    .select("order_id, bayi_orders(order_number, total_amount, status)")
    .eq("tenant_id", tenantId)
    .eq("visit_id", id);

  return NextResponse.json({
    success: true,
    visit: {
      id: visit.id as string,
      dealerId: visit.dealer_id as string,
      dealerName: (pick(visit.bayi_dealers)?.company_name as string) || (pick(visit.bayi_dealers)?.name as string) || "Bayi",
      dealerAddress: (pick(visit.bayi_dealers)?.address as string) || null,
      status: visit.status as string,
      checkInAt: visit.check_in_at as string,
      checkOutAt: (visit.check_out_at as string) || null,
      gpsLat: visit.gps_lat != null ? Number(visit.gps_lat) : null,
      gpsLng: visit.gps_lng != null ? Number(visit.gps_lng) : null,
      photoUrl: (visit.photo_url as string) || null,
      note: (visit.note as string) || null,
    },
    orders: (vorders ?? []).map((o) => ({
      id: o.order_id as string,
      orderNumber: (pick(o.bayi_orders)?.order_number as string) || "",
      total: Number(pick(o.bayi_orders)?.total_amount ?? 0),
      status: (pick(o.bayi_orders)?.status as string) || "pending",
    })),
  });
}

interface PatchBody {
  note?: string;
  photo_url?: string;
  gps_lat?: number | string;
  gps_lng?: number | string;
  check_out?: boolean;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId } = auth;
  const { id } = await params;

  const { data: visit } = await sb
    .from("bayi_visits")
    .select("id, plan_id, status")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .eq("id", id)
    .maybeSingle();
  if (!visit) return NextResponse.json({ error: "Ziyaret bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.note === "string") patch.note = body.note.trim() || null;
  if (typeof body.photo_url === "string") patch.photo_url = body.photo_url.trim() || null;
  if (body.gps_lat != null && body.gps_lat !== "") {
    const lat = Number(body.gps_lat);
    if (!Number.isFinite(lat) || Math.abs(lat) > GPS_LAT_MAX) {
      return NextResponse.json({ error: "Geçersiz GPS enlem." }, { status: 400 });
    }
    patch.gps_lat = lat;
  }
  if (body.gps_lng != null && body.gps_lng !== "") {
    const lng = Number(body.gps_lng);
    if (!Number.isFinite(lng) || Math.abs(lng) > GPS_LNG_MAX) {
      return NextResponse.json({ error: "Geçersiz GPS boylam." }, { status: 400 });
    }
    patch.gps_lng = lng;
  }

  if (body.check_out === true) {
    patch.status = "completed";
    patch.check_out_at = new Date().toISOString();
  }

  await sb.from("bayi_visits").update(patch).eq("tenant_id", tenantId).eq("id", id);

  // Check-out → ilişkili planı 'done' işaretle
  if (body.check_out === true && visit.plan_id) {
    await sb
      .from("bayi_visit_plans")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", visit.plan_id as string);
  }

  return NextResponse.json({ success: true });
}
