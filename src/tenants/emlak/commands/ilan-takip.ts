/**
 * /ilantakip — Sahibinden günlük lead takip kriterlerini kur/düzenle.
 * Magic-link oluşturur, kullanıcıyı /tr/takip sayfasına yönlendirir.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleIlanTakip(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/takip?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `🎯 *Günlük Sahibi İlan Takibi*\n\nHer sabah 06:45'te sahibinden'de son 24 saatte yayınlanan *sahibi* ilanlardan sana uyanları WhatsApp'a gönderiyorum.\n\nKriterlerini (bölge, mülk tipi, fiyat aralığı) ayarlamak için butona tıkla:`,
    "🎯 Kriter Kur",
    url,
    { skipNav: true },
  );
}
