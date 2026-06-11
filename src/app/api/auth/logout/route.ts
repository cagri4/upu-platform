/**
 * POST /api/auth/logout — oturumu kapat (H-10 session revocation).
 *
 * İki katmanlı:
 *   1. Cookie temizlenir (bu tarayıcı oturumu biter).
 *   2. profiles.sessions_revoked_at = now() damgalanır → bu kullanıcının
 *      damgadan ÖNCE üretilmiş TÜM token'ları (başka cihaz/çalınan kopya
 *      dahil) auth guard'larda geçersiz sayılır.
 *
 * Auth: mevcut cookie session (kendi oturumunu kapatır). Cookie yoksa
 * sadece temiz cookie döner (idempotent).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromCookies,
  attachClearToResponse,
} from "@/platform/auth/session";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const session = await getSessionFromCookies();

  // Tüm oturumları iptal et (revoke damgası)
  if (session?.uid) {
    try {
      const sb = getServiceClient();
      await sb
        .from("profiles")
        .update({ sessions_revoked_at: new Date().toISOString() })
        .eq("id", session.uid);
    } catch (err) {
      // Damga atılamasa bile cookie temizlenir — logout hiçbir zaman patlamaz
      console.error("[auth:logout] revoke stamp", err);
    }
  }

  const res = NextResponse.json({ success: true });
  return attachClearToResponse(res);
}
