/**
 * POST /api/bayi-kullanicilar/toggle-suspend — admin-only.
 * Body: { target_user_id: string }
 *
 * profile.metadata.suspended_at toggle. UI'da "Askıda" badge gösterimi.
 * Gerçek auth-block V2'de (profiles.is_active kolon eklenecek).
 *
 * NOT: Admin kendini askıya alamaz; son admin askıya alınamaz.
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

  const targetUserId = String(body.target_user_id || "").trim();
  if (!targetUserId) return NextResponse.json({ error: "target_user_id gerekli." }, { status: 400 });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }
  if (targetUserId === lookup.profile.id) {
    return NextResponse.json({ error: "Kendinizi askıya alamazsınız." }, { status: 400 });
  }

  const tenantId = lookup.tenantId;
  const { data: target } = await sb
    .from("profiles")
    .select("id, tenant_id, role, metadata")
    .eq("id", targetUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const meta = (target.metadata || {}) as Record<string, unknown>;
  const isSuspended = !!meta.suspended_at;

  // Son admin guard (admin'i askıya alıyorsak)
  if (!isSuspended && ADMIN_ROLES.has(target.role || "")) {
    const { count } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "user"]);
    if ((count || 0) <= 1) {
      return NextResponse.json({
        error: "En az bir aktif admin kalmalı.",
      }, { status: 409 });
    }
  }

  const newMeta = { ...meta };
  if (isSuspended) {
    delete newMeta.suspended_at;
  } else {
    newMeta.suspended_at = new Date().toISOString();
  }

  const { error } = await sb
    .from("profiles")
    .update({ metadata: newMeta, updated_at: new Date().toISOString() })
    .eq("id", targetUserId)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, suspended: !isSuspended });
}
