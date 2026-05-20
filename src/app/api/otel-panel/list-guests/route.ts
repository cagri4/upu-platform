/**
 * /api/otel-panel/list-guests — lifetime misafir listesi (role='guest'
 * profilleri). Tenant scope (owner'ın tenant'ı).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, guests: [] });

  const { data: guests } = await sb
    .from("profiles")
    .select("id, display_name, whatsapp_phone, metadata, created_at")
    .eq("tenant_id", lookup.tenantId)
    .eq("role", "guest")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, guests: guests || [] });
}
