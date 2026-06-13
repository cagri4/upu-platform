/**
 * GET  /api/saha/visits — bugünün ziyaret planları + ilişkili ziyaretler.
 * POST /api/saha/visits — check-in (ziyaret başlat).
 *   body: { dealer_id, plan_id?, gps_lat?, gps_lng?, photo_url?, note?, client_uuid? }
 *
 * Offline destek: client_uuid ile (tenant_id, client_uuid) UNIQUE upsert —
 * aynı offline check-in iki kez senkronlanırsa tek satır. Tüm sorgular
 * saha elemanının kendi tenant'ına + atanmış bayilerine scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../_auth";

export const dynamic = "force-dynamic";

const GPS_LAT_MAX = 90;
const GPS_LNG_MAX = 180;

function todayStr(): string {
  // Sunucu UTC; saha günü için yerel gün yeterli (TR). Basit: UTC tarih.
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId } = auth;

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayStr();

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  // Bugünün planları
  const { data: plans } = await sb
    .from("bayi_visit_plans")
    .select("id, dealer_id, planned_time, status, note, bayi_dealers(name, company_name, address, region)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .eq("planned_date", date)
    .order("planned_time", { ascending: true });

  // Bugünün ziyaretleri (plan'lı + ad-hoc)
  const { data: visits } = await sb
    .from("bayi_visits")
    .select("id, dealer_id, plan_id, status, check_in_at, check_out_at, note")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .gte("check_in_at", `${date}T00:00:00.000Z`)
    .order("check_in_at", { ascending: false });

  const visitByPlan = new Map<string, Record<string, unknown>>();
  const visitByDealer = new Map<string, Record<string, unknown>>();
  for (const v of visits ?? []) {
    if (v.plan_id) visitByPlan.set(v.plan_id as string, v);
    if (!visitByDealer.has(v.dealer_id as string)) visitByDealer.set(v.dealer_id as string, v);
  }

  const planCards = (plans ?? []).map((p) => {
    const visit = visitByPlan.get(p.id as string) || visitByDealer.get(p.dealer_id as string);
    return {
      planId: p.id as string,
      dealerId: p.dealer_id as string,
      dealerName: (pick(p.bayi_dealers)?.company_name as string) || (pick(p.bayi_dealers)?.name as string) || "Bayi",
      dealerAddress: (pick(p.bayi_dealers)?.address as string) || null,
      dealerRegion: (pick(p.bayi_dealers)?.region as string) || null,
      plannedTime: (p.planned_time as string) || null,
      planStatus: p.status as string,
      note: (p.note as string) || null,
      visitId: (visit?.id as string) || null,
      visitStatus: (visit?.status as string) || null,
      checkInAt: (visit?.check_in_at as string) || null,
      checkOutAt: (visit?.check_out_at as string) || null,
    };
  });

  return NextResponse.json({ success: true, date, plans: planCards });
}

interface CheckInBody {
  dealer_id?: string;
  plan_id?: string;
  gps_lat?: number | string;
  gps_lng?: number | string;
  photo_url?: string;
  note?: string;
  client_uuid?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, salesRepId } = auth;

  const body = (await req.json().catch(() => ({}))) as CheckInBody;
  const dealerId = (body.dealer_id || "").trim();
  if (!dealerId) {
    return NextResponse.json({ error: "Bayi zorunlu." }, { status: 400 });
  }

  // Bayi bu elemana atanmış mı + tenant'a ait mi
  const { data: assign } = await sb
    .from("bayi_sales_rep_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", salesRepId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  if (!assign) {
    return NextResponse.json({ error: "Bu bayi sana atanmamış." }, { status: 403 });
  }

  // Plan opsiyonel — verildiyse doğrula
  let planId: string | null = null;
  if (body.plan_id) {
    const { data: plan } = await sb
      .from("bayi_visit_plans")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sales_rep_id", salesRepId)
      .eq("id", body.plan_id)
      .maybeSingle();
    if (plan) planId = plan.id as string;
  }

  // GPS opsiyonel + sınır kontrolü
  const lat = body.gps_lat != null && body.gps_lat !== "" ? Number(body.gps_lat) : null;
  const lng = body.gps_lng != null && body.gps_lng !== "" ? Number(body.gps_lng) : null;
  if (lat != null && (!Number.isFinite(lat) || Math.abs(lat) > GPS_LAT_MAX)) {
    return NextResponse.json({ error: "Geçersiz GPS enlem." }, { status: 400 });
  }
  if (lng != null && (!Number.isFinite(lng) || Math.abs(lng) > GPS_LNG_MAX)) {
    return NextResponse.json({ error: "Geçersiz GPS boylam." }, { status: 400 });
  }

  const clientUuid = body.client_uuid?.trim() || null;
  const photoUrl = body.photo_url?.trim() || null;
  const note = body.note?.trim() || null;

  // Offline idempotency: client_uuid varsa upsert (aynı check-in 2× gelirse tek satır)
  if (clientUuid) {
    const { data: existing } = await sb
      .from("bayi_visits")
      .select("id, status, check_in_at")
      .eq("tenant_id", tenantId)
      .eq("client_uuid", clientUuid)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: true, id: existing.id as string, deduped: true });
    }
  }

  const { data: visit, error } = await sb
    .from("bayi_visits")
    .insert({
      tenant_id: tenantId,
      sales_rep_id: salesRepId,
      dealer_id: dealerId,
      plan_id: planId,
      status: "open",
      gps_lat: lat,
      gps_lng: lng,
      photo_url: photoUrl,
      note,
      client_uuid: clientUuid,
    })
    .select("id")
    .single();

  if (error || !visit) {
    // H-22: client_uuid yarış durumu (SELECT-then-INSERT TOCTOU). UNIQUE
    // (tenant_id, client_uuid) çift satırı zaten engelliyor; eşzamanlı offline
    // senkronda 23505 gelirse generic 400 yerine mevcut satırı dedupe dön.
    if (clientUuid && (error as { code?: string } | null)?.code === "23505") {
      const { data: ex } = await sb
        .from("bayi_visits")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("client_uuid", clientUuid)
        .maybeSingle();
      if (ex) return NextResponse.json({ success: true, id: ex.id as string, deduped: true });
    }
    console.error("[saha:visits:checkin]", error);
    return NextResponse.json({ error: "Check-in kaydedilemedi." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: visit.id as string });
}
