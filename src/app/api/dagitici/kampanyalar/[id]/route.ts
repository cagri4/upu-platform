/**
 * GET /api/dagitici/kampanyalar/[id] — detay + hedefleme + kural.
 * PUT /api/dagitici/kampanyalar/[id] — başlık + durum güncelle.
 * DELETE /api/dagitici/kampanyalar/[id] — soft delete (is_active=false, status='paused').
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TYPES = ["percent_discount", "volume_discount", "coupon", "gift_product", "free_shipping"];
const STATUSES = ["draft", "active", "paused", "ended"];

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: c, error } = await sb
    .from("bayi_campaigns")
    .select(
      "id, title, description, type, status, start_date, end_date, max_usage, per_dealer_max_usage, coupon_code, is_active, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[dagitici:kampanyalar:get]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!c) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const [{ data: targets }, { data: rules }] = await Promise.all([
    sb
      .from("bayi_campaign_targets")
      .select("id, target_type, target_value, created_at")
      .eq("tenant_id", tenantId)
      .eq("campaign_id", id),
    sb
      .from("bayi_campaign_rules")
      .select("id, rule_type, params, created_at")
      .eq("tenant_id", tenantId)
      .eq("campaign_id", id),
  ]);

  // Dealer hedefleri için bayi adlarını çek
  const dealerIds = (targets ?? [])
    .filter((t) => t.target_type === "dealer" && t.target_value)
    .map((t) => t.target_value as string);
  const dealerNames = new Map<string, string>();
  if (dealerIds.length > 0) {
    const { data: dealers } = await sb
      .from("bayi_dealers")
      .select("id, name, company_name")
      .eq("tenant_id", tenantId)
      .in("id", dealerIds);
    (dealers ?? []).forEach((d) => {
      dealerNames.set(
        d.id as string,
        (d.company_name as string) || (d.name as string) || "(adsız)",
      );
    });
  }

  return NextResponse.json({
    success: true,
    campaign: {
      id: c.id as string,
      title: c.title as string,
      description: (c.description as string) || null,
      type: (c.type as string) || null,
      status: (c.status as string) || "draft",
      startDate: c.start_date as string,
      endDate: c.end_date as string,
      maxUsage: c.max_usage != null ? Number(c.max_usage) : null,
      perDealerMaxUsage: c.per_dealer_max_usage != null ? Number(c.per_dealer_max_usage) : null,
      couponCode: (c.coupon_code as string) || null,
      isActive: Boolean(c.is_active),
      createdAt: c.created_at as string,
      updatedAt: c.updated_at as string,
    },
    targets: (targets ?? []).map((t) => ({
      id: t.id as string,
      targetType: t.target_type as string,
      targetValue: (t.target_value as string) || null,
      dealerName:
        t.target_type === "dealer" && t.target_value
          ? dealerNames.get(t.target_value as string) || null
          : null,
    })),
    rules: (rules ?? []).map((r) => ({
      id: r.id as string,
      ruleType: r.rule_type as string,
      params: (r.params as Record<string, unknown>) || {},
    })),
  });
}

interface UpdateBody {
  title?: string;
  description?: string | null;
  type?: string | null;
  status?: string;
  start_date?: string;
  end_date?: string;
  max_usage?: number | string | null;
  per_dealer_max_usage?: number | string | null;
  coupon_code?: string | null;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title != null) update.title = body.title.trim();
  if (body.description !== undefined)
    update.description = body.description?.toString().trim() || null;
  if (body.type !== undefined) {
    if (body.type && !TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Geçersiz tip." }, { status: 400 });
    }
    update.type = body.type || null;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.start_date !== undefined) update.start_date = body.start_date;
  if (body.end_date !== undefined) update.end_date = body.end_date;
  if (body.max_usage !== undefined) {
    update.max_usage =
      body.max_usage == null || body.max_usage === "" ? null : Number(body.max_usage);
  }
  if (body.per_dealer_max_usage !== undefined) {
    update.per_dealer_max_usage =
      body.per_dealer_max_usage == null || body.per_dealer_max_usage === ""
        ? null
        : Number(body.per_dealer_max_usage);
  }
  if (body.coupon_code !== undefined)
    update.coupon_code = body.coupon_code?.toString().trim() || null;

  const { error } = await sb
    .from("bayi_campaigns")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:kampanyalar:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  // Soft delete — sipariş geçmişinde referans olabilir, hard delete risk.
  const { error } = await sb
    .from("bayi_campaigns")
    .update({
      is_active: false,
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:kampanyalar:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
