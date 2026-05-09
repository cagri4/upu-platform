/**
 * POST /api/panel-session/logout — cookie tabanlı panel oturumunu kapatır.
 * Tüm paneller (emlak / bayi / market / otel) aynı `upu_session` cookie'yi
 * paylaşır → tek logout endpoint yeterli.
 */
import { NextResponse } from "next/server";
import { attachClearToResponse } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  return attachClearToResponse(response);
}
