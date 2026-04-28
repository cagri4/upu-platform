/**
 * /profilduzenle — kullanıcının kişisel emlakçı profilini düzenleme
 * sayfasına magic link gönderir. Profil bilgileri sunumlarda + web
 * sayfasında kullanılır.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleProfilDuzenle(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/profil-duzenle?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `🪪 *Profil Düzenle*\n\nProfil fotoğrafınız, ofis adresiniz, sektör tecrübeniz ve kısa biyografinizi güncellemek için aşağıdaki butonu kullanın. Bu bilgiler kişisel web sayfanızda gözükür.`,
    "🪪 Formu Aç",
    url,
    { skipNav: true },
  );
}
