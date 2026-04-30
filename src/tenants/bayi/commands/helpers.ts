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

/**
 * Wrap a command so it requires a specific tier feature. Çalışan tier'ı
 * yetersizse "Bu özellik X paketinde — yükseltme" mesajı gösterir,
 * orijinal handler çağrılmaz.
 *
 * Aşama 6 — multi_accounting / sepa_direct_debit / position_presets /
 * ai_dunning_text / multi_territory / storecove_peppol / custom_api /
 * custom_integrations / audit_log feature'ları için kullanılır.
 */
export function withTierGate(
  feature: "multi_accounting" | "sepa_direct_debit" | "position_presets" | "ai_dunning_text" | "multi_territory" | "storecove_peppol" | "custom_api" | "custom_integrations" | "audit_log",
  handler: CommandHandler,
): CommandHandler {
  return async (ctx: WaContext) => {
    const { getUserTier, tierAllows, MIN_TIER_FOR_FEATURE } = await import("../billing/tier-features");
    // Owner için kendi tier'ı; dealer/employee için owner tier'ı (helper içinde halledilir).
    const lookupId = (ctx.role === "dealer" || ctx.role === "employee")
      ? ctx.userId  // helper invited_by chain'i kendi takip eder
      : ctx.userId;
    const tier = await getUserTier(lookupId);

    if (tierAllows(tier, feature)) {
      await handler(ctx);
      return;
    }

    const requiredTier = MIN_TIER_FOR_FEATURE[feature];
    const tierLabel = requiredTier === "growth" ? "Growth (€249/ay)" : "Pro (€599/ay)";
    await sendText(ctx.phone,
      `🔒 Bu özellik *${tierLabel}* paketinde geliyor.\n\n` +
      `Mevcut paket: *${tier === "starter" ? "Starter" : tier === "growth" ? "Growth" : "Pro"}*.\n\n` +
      `Yükseltmek için: *retailai.upudev.nl/tr#pricing*`,
    );
  };
}
