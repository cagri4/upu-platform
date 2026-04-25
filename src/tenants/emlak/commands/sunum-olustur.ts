/**
 * /sunumolustur — Tek mülk için sunum oluşturma akışı.
 *
 * Kullanıcıya "önce bir mülk eklemeniz gerek" mesajı + Mülk Ekle magic
 * link butonu gönderir. /tr/mulkekle-form'a yönlenir; form kaydedince
 * /api/mulkekle/save zaten otomatik AI sunum üretip "Sunumu Gör"
 * butonunu after() içinde yollar.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleSunumOlustur(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/mulkekle-form?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `🎨 *Sunum Oluştur*\n\nSunum oluşturmak için önce bir portföyünüzü (mülkünüzü) eklemeniz gerekiyor. Aşağıdaki form üzerinden bilgileri ve fotoğraflarını paylaşın — yapay zekamla saniyeler içinde profesyonel bir sunum hazırlayıp size göndereceğim.`,
    "🏠 Mülk Ekle",
    url,
    { skipNav: true },
  );
}
