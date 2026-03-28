/**
 * Error handling + event logging for WhatsApp commands
 *
 * - Generic user-facing messages (no technical details)
 * - Structured internal logging
 * - bot_activity event tracking
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "./send";
import type { WaContext } from "./types";

// ── User-facing error messages ─────────────────────────────────────────

const USER_ERRORS: Record<string, string> = {
  db: "Veri yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.",
  not_found: "Aradığınız kayıt bulunamadı.",
  permission: "Bu işlem için yetkiniz bulunmuyor.",
  session: "İşlem süresi dolmuş. Lütfen tekrar başlatın.",
  unknown: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
};

export async function handleError(
  ctx: WaContext,
  source: string,
  err: unknown,
  type: keyof typeof USER_ERRORS = "unknown",
): Promise<void> {
  // Internal log — full detail
  console.error(`[${source}] error:`, err instanceof Error ? err.message : err);

  // User-facing — generic
  await sendButtons(ctx.phone, USER_ERRORS[type] || USER_ERRORS.unknown, [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

// ── Event logging ──────────────────────────────────────────────────────

export async function logEvent(
  tenantId: string,
  userId: string,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("bot_activity").insert({
      tenant_id: tenantId,
      user_id: userId,
      bot_type: "whatsapp",
      action,
      detail: detail || null,
    });
  } catch {
    // Don't let logging failures break the flow
  }
}
