/**
 * /yardim — Komut kullanım rehberi web sayfası.
 *
 * /tr/yardim sayfasına magic-link ile erişim — kullanıcı her komutun
 * "ne işe yarar / nasıl kullanılır / örnek / SSS" detayını görür.
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export async function handleYardim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/yardim?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `❓ *Yardım Merkezi*\n\nHer komutun nasıl kullanıldığını adım adım açıklayan rehbere ulaş — örnekler ve sık sorulan sorular dahil.`,
    "❓ Yardımı Aç",
    url,
    { skipNav: true },
  );
}
