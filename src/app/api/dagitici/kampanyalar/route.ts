/**
 * GET /api/dagitici/kampanyalar — kampanya listesi (filtre).
 * POST /api/dagitici/kampanyalar — yeni kampanya başlığı.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const TYPES = ["percent_discount", "volume_discount", "coupon", "gift_product", "free_shipping"] as const;
const STATUSES = ["draft", "active", "paused", "ended"] as const;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";

  let query = sb
    .from("bayi_campaigns")
    .select(
      "id, title, description, type, status, start_date, end_date, max_usage, per_dealer_max_usage, coupon_code, is_active, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (q) query = query.ilike("title", `%${q.replace(/[,()]/g, "")}%`);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (type && (TYPES as readonly string[]).includes(type)) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[dagitici:kampanyalar:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  // Target sayıları
  const ids = (data ?? []).map((c) => c.id as string);
  const targetCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: ts } = await sb
      .from("bayi_campaign_targets")
      .select("campaign_id")
      .eq("tenant_id", tenantId)
      .in("campaign_id", ids);
    (ts ?? []).forEach((t) => {
      const k = t.campaign_id as string;
      targetCounts.set(k, (targetCounts.get(k) ?? 0) + 1);
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const items = (data ?? []).map((c) => {
    const startDate = c.start_date as string;
    const endDate = c.end_date as string;
    const isPast = endDate < today;
    return {
      id: c.id as string,
      title: c.title as string,
      description: (c.description as string) || null,
      type: (c.type as string) || null,
      status: (c.status as string) || "draft",
      computedStatus: isPast && c.status === "active" ? "ended" : (c.status as string),
      startDate,
      endDate,
      maxUsage: c.max_usage != null ? Number(c.max_usage) : null,
      perDealerMaxUsage: c.per_dealer_max_usage != null ? Number(c.per_dealer_max_usage) : null,
      couponCode: (c.coupon_code as string) || null,
      targetCount: targetCounts.get(c.id as string) ?? 0,
      isActive: Boolean(c.is_active),
      createdAt: c.created_at as string,
      updatedAt: c.updated_at as string,
    };
  });

  return NextResponse.json({ success: true, items });
}

interface NewCampaignBody {
  title?: string;
  description?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  max_usage?: number | string;
  per_dealer_max_usage?: number | string;
  coupon_code?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewCampaignBody;
  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "İsim zorunlu." }, { status: 400 });
  }
  if (body.type && !(TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ error: "Geçersiz kampanya tipi." }, { status: 400 });
  }
  const status = body.status && (STATUSES as readonly string[]).includes(body.status) ? body.status : "draft";
  if (!body.start_date || !body.end_date) {
    return NextResponse.json({ error: "Başlangıç ve bitiş tarihi zorunlu." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    title,
    description: body.description?.trim() || null,
    type: body.type || null,
    status,
    start_date: body.start_date,
    end_date: body.end_date,
    max_usage:
      body.max_usage != null && body.max_usage !== "" ? Number(body.max_usage) : null,
    per_dealer_max_usage:
      body.per_dealer_max_usage != null && body.per_dealer_max_usage !== ""
        ? Number(body.per_dealer_max_usage)
        : null,
    coupon_code: body.coupon_code?.trim() || null,
    created_by_profile_id: profileId,
    is_active: true,
  };

  const { data, error } = await sb
    .from("bayi_campaigns")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:kampanyalar:create]", error);
    return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data!.id });
}
