/**
 * POST /api/bayi-ayarlar/wa-broadcast — admin-only.
 * Body: { enabled: boolean }
 *
 * Owner profile.metadata.briefing_enabled toggle. Cron sabah brifingi
 * shouldNotify gate'i bu flag'i okur. Bayi WA pivot sonrası ek sabah
 * bildirimleri pasif tutulabilir (panel'den asıl içerik geliyor).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const enabled = body.enabled === true;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
    metadata: Record<string, unknown> | null; invited_by: string | null;
  }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, metadata, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }

  // Tenant-wide setting owner profilinde tutulur
  const ownerId = lookup.profile.invited_by || lookup.profile.id;
  const { data: owner } = await sb
    .from("profiles")
    .select("id, metadata")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "Owner profili bulunamadı." }, { status: 500 });

  const meta = (owner.metadata || {}) as Record<string, unknown>;
  const newMeta = { ...meta, briefing_enabled: enabled };
  const { error } = await sb
    .from("profiles")
    .update({ metadata: newMeta, updated_at: new Date().toISOString() })
    .eq("id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, enabled });
}
