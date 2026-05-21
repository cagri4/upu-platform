/**
 * POST /api/bayi-drip/upsert — drip kampanya + step'lerini kaydeder.
 * Body: { token?, id?, name, description?, audience, channel?, enrollment_mode?, is_active?, steps: [{step_order, delay_days, channel?, subject?, body}] }
 * Atomicite basit: önce campaign upsert, sonra step'leri silip yeniden insert (≤20 step).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const VALID_AUDIENCE_KINDS = new Set(["all", "inactive_days", "score_below", "overdue", "new_dealer_days"]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (lookup.profile.role !== "admin") {
    return NextResponse.json({ error: "Yalnız admin oluşturabilir." }, { status: 403 });
  }

  const name = String(body.name || "").trim().slice(0, 200);
  if (!name) return NextResponse.json({ error: "Kampanya adı zorunlu." }, { status: 400 });

  const audience = body.audience && typeof body.audience === "object" ? body.audience : { kind: "all" };
  if (!VALID_AUDIENCE_KINDS.has(audience.kind)) {
    return NextResponse.json({ error: "Geçersiz audience.kind." }, { status: 400 });
  }

  const channel = ["whatsapp", "email", "both"].includes(body.channel) ? body.channel : "whatsapp";
  const enrollmentMode = ["manual", "auto", "one_time"].includes(body.enrollment_mode) ? body.enrollment_mode : "manual";
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, 20) : [];

  if (steps.length === 0) {
    return NextResponse.json({ error: "En az 1 adım gerekli." }, { status: 400 });
  }

  const campaignPayload = {
    tenant_id: lookup.tenantId,
    name,
    description: body.description ? String(body.description).slice(0, 500) : null,
    audience,
    channel,
    enrollment_mode: enrollmentMode,
    is_active: body.is_active === true,
    updated_at: new Date().toISOString(),
    created_by: lookup.profile.id,
  };

  let campaignId = body.id;
  if (campaignId) {
    const { error } = await sb
      .from("bayi_drip_campaigns")
      .update(campaignPayload)
      .eq("id", campaignId)
      .eq("tenant_id", lookup.tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Replace steps
    await sb.from("bayi_drip_steps").delete().eq("campaign_id", campaignId);
  } else {
    const { data, error } = await sb
      .from("bayi_drip_campaigns")
      .insert(campaignPayload)
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Kayıt başarısız." }, { status: 500 });
    campaignId = data.id;
  }

  interface StepInput { step_order?: number; delay_days?: number; channel?: string; subject?: string; body?: string }
  interface StepRow { campaign_id: string; step_order: number; delay_days: number; channel: string; subject: string | null; body: string; is_active: boolean }
  const stepRows: StepRow[] = (steps as StepInput[]).map((s, idx) => ({
    campaign_id: campaignId as string,
    step_order: Number(s.step_order) || idx + 1,
    delay_days: Math.max(0, Number(s.delay_days) || 0),
    channel: s.channel || channel,
    subject: s.subject ? String(s.subject).slice(0, 200) : null,
    body: String(s.body || "").slice(0, 2000),
    is_active: true,
  })).filter((s: StepRow) => s.body);

  if (stepRows.length === 0) {
    return NextResponse.json({ error: "Step body'leri boş olamaz." }, { status: 400 });
  }

  const { error: stepsErr } = await sb.from("bayi_drip_steps").insert(stepRows);
  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, campaign_id: campaignId, step_count: stepRows.length });
}
