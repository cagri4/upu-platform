/**
 * POST /api/dagitici/kampanyalar/[id]/hedefleme
 *   body: { target_type: 'all'|'segment'|'region'|'dealer', target_value?: string }
 *
 * 'all' tipinde target_value yok. Duplicate (kampanya × target_type × target_value)
 * eklemez (idempotent).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TARGET_TYPES = ["all", "segment", "region", "dealer"] as const;

interface AddTargetBody {
  target_type?: string;
  target_value?: string;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: campaignId } = await params;

  const body = (await req.json().catch(() => ({}))) as AddTargetBody;
  const targetType = body.target_type;
  if (!targetType || !(TARGET_TYPES as readonly string[]).includes(targetType)) {
    return NextResponse.json(
      { error: "target_type all/segment/region/dealer olmalı." },
      { status: 400 },
    );
  }
  let targetValue: string | null = body.target_value?.trim() || null;
  if (targetType === "all") targetValue = null;
  if (targetType !== "all" && !targetValue) {
    return NextResponse.json({ error: "target_value zorunlu." }, { status: 400 });
  }

  // Kampanya tenant'a ait mi?
  const { data: c } = await sb
    .from("bayi_campaigns")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 });

  // segment için A/B/C kontrolü
  if (targetType === "segment" && targetValue && !["A", "B", "C"].includes(targetValue)) {
    return NextResponse.json({ error: "Segment A/B/C olmalı." }, { status: 400 });
  }

  // dealer için tenant'a ait mi?
  if (targetType === "dealer" && targetValue) {
    const { data: d } = await sb
      .from("bayi_dealers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", targetValue)
      .maybeSingle();
    if (!d) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 400 });
  }

  // Duplicate kontrol
  const { data: existing } = await sb
    .from("bayi_campaign_targets")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId)
    .eq("target_type", targetType)
    .eq("target_value", targetValue ?? "");
  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, id: existing[0].id, alreadyExists: true });
  }

  const { data, error } = await sb
    .from("bayi_campaign_targets")
    .insert({
      tenant_id: tenantId,
      campaign_id: campaignId,
      target_type: targetType,
      target_value: targetValue,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:kampanyalar:hedefleme:add]", error);
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: data!.id });
}
