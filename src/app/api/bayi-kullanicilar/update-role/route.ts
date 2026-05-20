/**
 * POST /api/bayi-kullanicilar/update-role — admin-only.
 * Body: { target_user_id: string, role: "admin"|"muhasebe"|"depocu"|"satis" }
 *
 * Aynı tenant içinde rol değişikliği. Admin kendi rolünü düşürürse "son admin"
 * check'i yapılır (en az bir admin kalmalı, kilitlemeyi önle).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["admin", "muhasebe", "depocu", "satis"]);
const ADMIN_ROLES = new Set(["admin", "user"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const targetUserId = String(body.target_user_id || "").trim();
  const newRole = String(body.role || "").trim();
  if (!targetUserId) return NextResponse.json({ error: "target_user_id gerekli." }, { status: 400 });
  if (!VALID_ROLES.has(newRole)) {
    return NextResponse.json({ error: `Geçersiz rol. Geçerli: ${[...VALID_ROLES].join("/")}` }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }

  const tenantId = lookup.tenantId;

  // Target profil aynı tenant'ta olmalı
  const { data: target } = await sb
    .from("profiles")
    .select("id, tenant_id, role")
    .eq("id", targetUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  // Son admin guard — eğer target şu an admin ve yeni rol admin değil, başka admin kalıyor mu?
  if (ADMIN_ROLES.has(target.role || "") && newRole !== "admin") {
    const { count } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "user"]);
    if ((count || 0) <= 1) {
      return NextResponse.json({
        error: "En az bir admin kalmalı — başka admin atayın önce.",
      }, { status: 409 });
    }
  }

  const { error } = await sb
    .from("profiles")
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq("id", targetUserId)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
