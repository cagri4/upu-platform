/**
 * Market — Warm Welcome (3 mesaj sıralı, ~1.8 sn aralık).
 *
 * Pattern emlak (panel) default akışı + bayi/restoran 2-blok pattern arası:
 * 3 mesaj + sleep + Mesaj 3 panel CTA. Mevcut market 4-adımlı
 * onboarding-flow.ts (market_adi/sektor/urun_sayisi/briefing) atlanır;
 * kullanıcı `/market-profilim` formundan detayları sonradan doldurur
 * (emlak pattern'i ile birebir).
 *
 * Replikasyon brief (2026-05-07) referansı:
 *   - Core promise: "kasanızı her gün düzenli tutmak için çalışacağım"
 *   - 4 madde: brifing / kritik stok + tedarikçi / sadakat + doğum günü / tedarikçi sipariş
 *   - Mesaj 3: 🖥 Paneli Aç → /tr/market-panelim?t=<TOKEN>
 *   - Formal "siz" dili
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startMarketIntro(ctx: WaContext): Promise<boolean> {
  const supabase = getServiceClient();

  // Profil çek — firstName için
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata, display_name")
    .eq("id", ctx.userId)
    .single();
  const displayName = (profile?.display_name as string) || ctx.userName || "";
  const firstName = displayName.split(/\s+/)[0] || "";

  // Mesaj 1 — greeting + core promise (formal "siz")
  const greeting = firstName
    ? `👋 Merhaba ${firstName}! ✨\n\nBen kişisel asistanınız UPU. 7/24 kasanızı her gün düzenli tutmak için çalışacağım.`
    : `👋 Merhaba! ✨\n\nBen kişisel asistanınız UPU. 7/24 kasanızı her gün düzenli tutmak için çalışacağım.`;
  await sendText(ctx.phone, greeting);

  await sleep(1800);

  // Mesaj 2 — 4 kabiliyet (brief'ten birebir)
  const capabilities =
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Sabah dünkü ciro + bugün stok brifinginizi getiririm\n` +
    `✅ Stok kritik seviyeye düşünce uyarır, tedarikçi sipariş önerisi sunarım\n` +
    `✅ Müşteri sadakat hatırlatmaları ve doğum günü kupon önerileri hazırlarım\n` +
    `✅ Tedarikçi siparişlerinizi WA'dan tek akışta sisteme alırım`;
  await sendText(ctx.phone, capabilities);

  await sleep(1800);

  // Mesaj 3 — Paneli Aç CTA (magic link mint inline)
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://marketai.upudev.nl";
  const panelToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId, token: panelToken, expires_at: expiresAt,
  });
  const panelUrl = `${APP_URL}/tr/market-panelim?t=${panelToken}`;
  const ctaMsg =
    `🖥 *Yönetim paneliniz hazır.*\n\n` +
    `Tüm sisteminizi yönetmek için panele gidin.\n\n` +
    `_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._`;
  await sendUrlButton(ctx.phone, ctaMsg, "🖥 Paneli Aç", panelUrl, { skipNav: true });

  // Mark onboarding completed (4-adımlı eski onboarding-flow.ts skip edilir)
  const newMeta = {
    ...(profile?.metadata as Record<string, unknown> || {}),
    onboarding_completed: true,
    discovery_step: "completed",
  };
  await supabase.from("profiles").update({ metadata: newMeta }).eq("id", ctx.userId);

  return true;
}
