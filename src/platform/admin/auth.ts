/**
 * Admin guard helper — admin endpoint'lerinde kullanılır.
 *
 * Cookie session veya token üzerinden userId çözer, sonra "platform admin"
 * kontrolü yapar: role='admin' AND tenant_id IS NULL.
 *
 * Tenant sahipleri de role='admin' ama bir tenant'a bağlıdır; onlar bu
 * gate'ten geçemez. /api/admin/* endpoint'leri yalnız UPU Dev sahibine açık.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export type AdminAuthResult =
  | { userId: string }
  | { error: NextResponse };

export async function requireAdminUser(req: NextRequest): Promise<AdminAuthResult> {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", auth.userId)
    .maybeSingle();

  // Platform admin = role admin VE tenant'sız. Tenant sahipleri de role='admin'
  // ama tenant_id set → onları reddet.
  if (profile?.role !== "admin" || profile?.tenant_id !== null) {
    return { error: NextResponse.json({ error: "Forbidden — admin required." }, { status: 403 }) };
  }

  return { userId: auth.userId };
}
