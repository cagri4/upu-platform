/**
 * GET  /api/dagitici/saha/plan?rep_id=&date= — ziyaret planı listesi (filtreli).
 * POST /api/dagitici/saha/plan — yeni ziyaret planı.
 *   body: { sales_rep_id, dealer_id, planned_date (YYYY-MM-DD), planned_time?, note? }
 *
 * Onay kuralı: atanmış bayi elemana ve tenant'a ait mi doğrulanır (dealer
 * tenant'a ait + rep tenant'a ait). Atama zorunlu değil ama plan yine de
 * tenant izolasyonuna tabidir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const repId = url.searchParams.get("rep_id");
  const date = url.searchParams.get("date");

  let q = sb
    .from("bayi_visit_plans")
    .select("id, sales_rep_id, dealer_id, planned_date, planned_time, status, note, bayi_dealers(name, company_name), bayi_sales_reps(name)")
    .eq("tenant_id", tenantId)
    .order("planned_date", { ascending: true });
  if (repId) q = q.eq("sales_rep_id", repId);
  if (date && DATE_RE.test(date)) q = q.eq("planned_date", date);

  const { data, error } = await q.limit(200);
  if (error) {
    console.error("[dagitici:saha:plan:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((p) => ({
      id: p.id as string,
      salesRepId: p.sales_rep_id as string,
      salesRepName: (pick(p.bayi_sales_reps)?.name as string) || "Eleman",
      dealerId: p.dealer_id as string,
      dealerName: (pick(p.bayi_dealers)?.company_name as string) || (pick(p.bayi_dealers)?.name as string) || "Bayi",
      plannedDate: p.planned_date as string,
      plannedTime: (p.planned_time as string) || null,
      status: p.status as string,
      note: (p.note as string) || null,
    })),
  });
}

interface NewPlanBody {
  sales_rep_id?: string;
  dealer_id?: string;
  planned_date?: string;
  planned_time?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewPlanBody;
  const salesRepId = (body.sales_rep_id || "").trim();
  const dealerId = (body.dealer_id || "").trim();
  const plannedDate = (body.planned_date || "").trim();
  const plannedTime = body.planned_time?.trim() || null;

  if (!salesRepId || !dealerId) {
    return NextResponse.json({ error: "Eleman ve bayi zorunlu." }, { status: 400 });
  }
  if (!DATE_RE.test(plannedDate)) {
    return NextResponse.json({ error: "Geçerli tarih gir (YYYY-AA-GG)." }, { status: 400 });
  }
  if (plannedTime && !TIME_RE.test(plannedTime)) {
    return NextResponse.json({ error: "Geçerli saat gir (SS:DD)." }, { status: 400 });
  }

  // Eleman + bayi tenant doğrulama
  const [{ data: rep }, { data: dealer }] = await Promise.all([
    sb.from("bayi_sales_reps").select("id").eq("tenant_id", tenantId).eq("id", salesRepId).maybeSingle(),
    sb.from("bayi_dealers").select("id").eq("tenant_id", tenantId).eq("id", dealerId).maybeSingle(),
  ]);
  if (!rep) return NextResponse.json({ error: "Eleman bulunamadı." }, { status: 404 });
  if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });

  const { data, error } = await sb
    .from("bayi_visit_plans")
    .insert({
      tenant_id: tenantId,
      sales_rep_id: salesRepId,
      dealer_id: dealerId,
      planned_date: plannedDate,
      planned_time: plannedTime,
      note: body.note?.trim() || null,
      status: "planned",
      created_by: profileId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[dagitici:saha:plan:create]", error);
    return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
