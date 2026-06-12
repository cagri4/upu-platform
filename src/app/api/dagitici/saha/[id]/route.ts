/**
 * GET   /api/dagitici/saha/[id] — eleman detayı (+atanmış bayiler, planlar, ziyaretler).
 * PATCH /api/dagitici/saha/[id] — eleman güncelle (name/region/is_active + atanmış bayiler).
 *   body: { name?, region?, is_active?, dealer_ids?: string[] }  // dealer_ids verilirse SET (replace)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: rep } = await sb
    .from("bayi_sales_reps")
    .select("id, name, phone, region, user_id, is_active, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!rep) return NextResponse.json({ error: "Eleman bulunamadı." }, { status: 404 });

  const { data: assigns } = await sb
    .from("bayi_sales_rep_dealers")
    .select("dealer_id, bayi_dealers(name, company_name, region)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", id);

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  const { data: plans } = await sb
    .from("bayi_visit_plans")
    .select("id, dealer_id, planned_date, planned_time, status, note, bayi_dealers(name, company_name)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", id)
    .order("planned_date", { ascending: false })
    .limit(50);

  const { data: visits } = await sb
    .from("bayi_visits")
    .select("id, dealer_id, status, check_in_at, check_out_at, note, bayi_dealers(name, company_name)")
    .eq("tenant_id", tenantId)
    .eq("sales_rep_id", id)
    .order("check_in_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    success: true,
    rep: {
      id: rep.id as string,
      name: rep.name as string,
      phone: rep.phone as string,
      region: (rep.region as string) || null,
      hasLogin: Boolean(rep.user_id),
      isActive: Boolean(rep.is_active),
    },
    dealers: (assigns ?? []).map((a) => ({
      id: a.dealer_id as string,
      name: (pick(a.bayi_dealers)?.company_name as string) || (pick(a.bayi_dealers)?.name as string) || "Bayi",
      region: (pick(a.bayi_dealers)?.region as string) || null,
    })),
    plans: (plans ?? []).map((p) => ({
      id: p.id as string,
      dealerId: p.dealer_id as string,
      dealerName: (pick(p.bayi_dealers)?.company_name as string) || (pick(p.bayi_dealers)?.name as string) || "Bayi",
      plannedDate: p.planned_date as string,
      plannedTime: (p.planned_time as string) || null,
      status: p.status as string,
      note: (p.note as string) || null,
    })),
    visits: (visits ?? []).map((v) => ({
      id: v.id as string,
      dealerId: v.dealer_id as string,
      dealerName: (pick(v.bayi_dealers)?.company_name as string) || (pick(v.bayi_dealers)?.name as string) || "Bayi",
      status: v.status as string,
      checkInAt: v.check_in_at as string,
      checkOutAt: (v.check_out_at as string) || null,
      note: (v.note as string) || null,
    })),
  });
}

interface PatchBody {
  name?: string;
  region?: string;
  is_active?: boolean;
  dealer_ids?: string[];
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: rep } = await sb
    .from("bayi_sales_reps")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!rep) return NextResponse.json({ error: "Eleman bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;

  // Mass-assignment koruması: yalnız izinli alanlar. tenant_id/user_id/phone
  // enjeksiyonu yok sayılır.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.region === "string") patch.region = body.region.trim() || null;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  await sb.from("bayi_sales_reps").update(patch).eq("tenant_id", tenantId).eq("id", id);

  // Atanmış bayileri SET (replace) — dealer_ids verildiyse
  if (Array.isArray(body.dealer_ids)) {
    const wanted = Array.from(new Set(body.dealer_ids.filter((x) => typeof x === "string" && x)));
    const { data: valid } = await sb
      .from("bayi_dealers")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("id", wanted.length > 0 ? wanted : ["00000000-0000-0000-0000-000000000000"]);
    const validIds = (valid ?? []).map((d) => d.id as string);

    await sb.from("bayi_sales_rep_dealers").delete().eq("tenant_id", tenantId).eq("sales_rep_id", id);
    if (validIds.length > 0) {
      await sb.from("bayi_sales_rep_dealers").insert(
        validIds.map((dealerId) => ({ tenant_id: tenantId, sales_rep_id: id, dealer_id: dealerId })),
      );
    }
  }

  return NextResponse.json({ success: true });
}
