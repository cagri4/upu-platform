/**
 * POST /api/dagitici/kampanyalar/[id]/kural — kural ekle veya tek kural değiştir.
 *   body: { rule_type: 'percent_discount'|..., params: {...}, replace?: boolean }
 *
 * Bir kampanyaya birden çok kural ekleyebilirsin (örn. hediye + ücretsiz
 * kargo). replace=true ise bu kampanyanın TÜM kurallarını silip yenisini
 * koyar (UI'da "kuralı değiştir" akışı için).
 *
 * DELETE /api/dagitici/kampanyalar/[id]/kural?rule_id=... — tek kuralı sil
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const RULE_TYPES = [
  "percent_discount",
  "volume_discount",
  "coupon",
  "gift_product",
  "free_shipping",
];

interface AddRuleBody {
  rule_type?: string;
  params?: Record<string, unknown>;
  replace?: boolean;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: campaignId } = await params;

  const body = (await req.json().catch(() => ({}))) as AddRuleBody;
  const ruleType = body.rule_type;
  if (!ruleType || !RULE_TYPES.includes(ruleType)) {
    return NextResponse.json(
      { error: "rule_type 5 tipten biri olmalı." },
      { status: 400 },
    );
  }

  const ruleParams = body.params || {};

  // Kampanya tenant'a ait mi?
  const { data: c } = await sb
    .from("bayi_campaigns")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 });

  if (body.replace) {
    await sb
      .from("bayi_campaign_rules")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("campaign_id", campaignId);
  }

  const { data, error } = await sb
    .from("bayi_campaign_rules")
    .insert({
      tenant_id: tenantId,
      campaign_id: campaignId,
      rule_type: ruleType,
      params: ruleParams,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:kampanyalar:kural:add]", error);
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: data!.id });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: campaignId } = await params;

  const url = new URL(req.url);
  const ruleId = url.searchParams.get("rule_id");
  if (!ruleId) {
    return NextResponse.json({ error: "rule_id query gerekli." }, { status: 400 });
  }

  const { error } = await sb
    .from("bayi_campaign_rules")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId)
    .eq("id", ruleId);

  if (error) {
    console.error("[dagitici:kampanyalar:kural:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
