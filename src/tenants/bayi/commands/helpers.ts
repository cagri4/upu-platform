/**
 * Bayi command helpers — shared formatting + web panel redirect + profile gate
 */

import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";
import type { CommandHandler, WaContext } from "@/platform/whatsapp/types";
import {
  formatCurrency as platformFormatCurrency,
  type SupportedCurrency,
  type SupportedLocale,
} from "@/platform/i18n/currency";
import {
  today as platformToday,
  formatDate as platformFormatDate,
  shortDate as platformShortDate,
} from "@/platform/i18n/datetime";

const WEB_PANEL = "https://upu-platform.vercel.app/bayi";

// Tenant default — bayi tenant'ı NL Türk dağıtıcı odaklı (EUR + tr-NL).
// Per-order veya per-user override gerekiyorsa platform utility'sine
// currency/locale parametresi geçilir.
const TENANT_DEFAULT_CURRENCY: SupportedCurrency = "EUR";
const TENANT_DEFAULT_LOCALE: SupportedLocale = "tr-NL";

export function today(): string {
  return platformToday(TENANT_DEFAULT_LOCALE);
}

export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = TENANT_DEFAULT_CURRENCY,
  locale: SupportedLocale = TENANT_DEFAULT_LOCALE,
): string {
  return platformFormatCurrency(amount, currency, locale);
}

export function formatDate(dateStr: string): string {
  return platformFormatDate(dateStr, TENANT_DEFAULT_LOCALE);
}

export function shortDate(dateStr: string): string {
  return platformShortDate(dateStr, TENANT_DEFAULT_LOCALE);
}

export function webPanelRedirect(phone: string, action: string): Promise<void> {
  return sendText(phone, `Bu islemi web panelinden yapabilirsiniz:\n\n${action}\n\n${WEB_PANEL}`);
}

/**
 * Wrap a state-changing command so it can only run after the owner has
 * filled the firma-profili web form. Dealers and employees pass through
 * untouched (they're operating against the owner's profile).
 *
 * Profile incomplete → 7-day magic link mint + "📝 Firma Profili" URL
 * button; original handler is NOT called.
 */
export function withProfileGate(handler: CommandHandler): CommandHandler {
  return async (ctx: WaContext) => {
    if (ctx.role !== "admin" && ctx.role !== "user") {
      await handler(ctx);
      return;
    }

    const sb = getServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("metadata")
      .eq("id", ctx.userId)
      .maybeSingle();
    const meta = (profile?.metadata || {}) as Record<string, unknown>;
    const completed = meta.firma_profili_completed === true || meta.onboarding_completed === true;

    if (completed) {
      await handler(ctx);
      return;
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("magic_link_tokens").insert({
      user_id: ctx.userId, token, expires_at: expiresAt,
    });
    const url = `https://retailai.upudev.nl/tr/bayi-profil?t=${token}`;
    await sendUrlButton(ctx.phone,
      `📝 *Önce firma profilinizi tamamlayın*\n\n` +
      `Bu işlem için sektör, ofis bilgileri ve brifing tercihiniz gerekiyor. Tek formda ~5 dakika.`,
      "📝 Firma Profili",
      url,
      { skipNav: true },
    );
  };
}
