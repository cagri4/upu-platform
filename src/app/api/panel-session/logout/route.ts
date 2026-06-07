/**
 * POST /api/panel-session/logout — cookie tabanlı oturumları kapatır.
 *
 * 2026-06-07: Adminpanel ayrı cookie namespace'e (`upu_admin_session`)
 * geçtikten sonra logout artık her iki cookie'yi de temizliyor. Paylaşılan
 * cihaz senaryosunda admin oturumu açık kalmasın diye.
 *
 * Tüm paneller (emlak / bayi / market / otel) `upu_session` cookie'yi
 * paylaşır; admin panel ise `upu_admin_session`.
 */
import { NextResponse } from "next/server";
import {
  attachClearToResponse,
  attachAdminClearToResponse,
} from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  attachClearToResponse(response);
  attachAdminClearToResponse(response);
  return response;
}
