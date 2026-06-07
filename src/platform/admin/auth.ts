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
import { getAdminSessionFromCookies } from "@/platform/auth/session";

export type AdminAuthResult =
  | { userId: string }
  | { error: NextResponse };

export async function requireAdminUser(_req: NextRequest): Promise<AdminAuthResult> {
  // Admin cookie ayrı namespace'te (`upu_admin_session`); SaaS panel signup
  // tarafından ezilmiyor. Bkz. session.ts ADMIN_COOKIE_NAME (2026-06-07 fix).
  const session = await getAdminSessionFromCookies();
  if (!session?.uid) {
    return { error: NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 }) };
  }

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", session.uid)
    .maybeSingle();

  // 2026-06-07 mimari: is_platform_admin bayrak migration ile eklendi.
  // Trigger gerçek değeri role+tenant_id'den türetiyor; check tek koşula
  // indi. Tenant sahipleri (role='admin' + tenant_id set) için bayrak false.
  if (!profile?.is_platform_admin) {
    return { error: NextResponse.json({ error: "Forbidden — admin required." }, { status: 403 }) };
  }

  return { userId: session.uid };
}
