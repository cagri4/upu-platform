/**
 * POST /api/bayi-kullanicilar/cancel-invite — admin-only.
 * Body: { invite_id: string, type: "user" | "dealer" }
 *
 * Pending davet'i cancelled olarak işaretler. Token'ı pratik olarak iptal eder
 * (status check kabul akışında).
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

  const inviteId = String(body.invite_id || "").trim();
  const type = String(body.type || "").trim();
  if (!inviteId) return NextResponse.json({ error: "invite_id gerekli." }, { status: 400 });
  if (type !== "user" && type !== "dealer") {
    return NextResponse.json({ error: "type 'user' veya 'dealer' olmalı." }, { status: 400 });
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

  if (type === "user") {
    const { error } = await sb
      .from("user_invitations")
      .update({ status: "cancelled" })
      .eq("id", inviteId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb
      .from("dealer_invitations")
      .update({ status: "cancelled" })
      .eq("id", inviteId)
      .eq("distributor_tenant_id", tenantId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
