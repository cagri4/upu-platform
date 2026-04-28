/**
 * /portfoyara — Aynı /tr/ara sayfasına magic-link ile yeniden giriş.
 *
 * İntro akışında bir kez gösterilen Hızlı Arama formuna kullanıcının
 * istediği zaman tekrar dönmesi için menü kısayolu.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handlePortfoyAra(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/ara?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `🔍 *Portföy Ara*\n\nSahibinden'de son 24 saatte yayınlanan sahibi ilanları kriterlerinize göre tarayalım.\n\nFormu açıp ilan tipi, mülk tipi ve fiyat aralığını seçin — uyan ilanlar altta dökülecek. Mülk tipini değiştirerek farklı sonuçlara da bakabilirsiniz.`,
    "🔍 Aramaya Başla",
    url,
    { skipNav: true },
  );
}
