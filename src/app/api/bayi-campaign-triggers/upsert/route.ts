/**
 * POST /api/bayi-campaign-triggers/upsert — kural oluştur veya güncelle.
 * Body: { id?, name, description?, event_type, conditions, action_type, action_payload?, cooldown_days?, is_active? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { isValidEventType, isValidActionType } from "@/platform/bayi-campaigns/rule-engine";

export const dynamic = "force-dynamic";
const ADMIN = new Set(["admin", "user"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }

  const name = String(body.name || "").trim();
  const event_type = String(body.event_type || "").trim();
  const action_type = String(body.action_type || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "İsim en az 2 karakter." }, { status: 400 });
  if (!isValidEventType(event_type)) return NextResponse.json({ error: "Geçersiz event_type." }, { status: 400 });
  if (!isValidActionType(action_type)) return NextResponse.json({ error: "Geçersiz action_type." }, { status: 400 });

  const row = {
    tenant_id: lookup.tenantId,
    created_by: lookup.profile.id,
    name,
    description: body.description ? String(body.description).trim() : null,
    event_type,
    conditions: body.conditions || {},
    action_type,
    action_payload: body.action_payload || {},
    cooldown_days: Math.max(1, Math.min(365, Number(body.cooldown_days) || 30)),
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    const { error } = await sb.from("bayi_campaign_triggers")
      .update(row).eq("id", body.id).eq("tenant_id", lookup.tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: body.id });
  }
  const { data, error } = await sb.from("bayi_campaign_triggers")
    .insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
