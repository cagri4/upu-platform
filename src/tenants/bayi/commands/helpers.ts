/**
 * Bayi command helpers — shared formatting + web panel redirect + profile gate
 */

import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";
import type { CommandHandler, WaContext } from "@/platform/whatsapp/types";

const WEB_PANEL = "https://upu-platform.vercel.app/bayi";

export function today(): string {
  return new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
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
