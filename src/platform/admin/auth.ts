/**
 * Admin guard helper — admin endpoint'lerinde kullanılır.
 *
 * Cookie session veya token üzerinden userId çözer, sonra profiles.role
 * == "admin" kontrolü yapar. Platform-wide admin tek bir kullanıcı (UPU
 * Dev sahibi) olduğu için role-based check yeterli.
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
    .select("role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden — admin required." }, { status: 403 }) };
  }

  return { userId: auth.userId };
}
