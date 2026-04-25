/**
 * /websayfam — kullanıcının kişisel web sayfasını yöneteceği panele
 * magic link gönderir. URL kopyalama, WA paylaşım, önizleme, profil
 * düzenleme gibi aksiyonlar oradan yapılır.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton, sendButtons } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleWebSayfam(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Slug var mı?
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ctx.userId)
    .single();
  const meta = (profile?.metadata as Record<string, unknown> | null) || {};
  const agent = (meta.agent_profile as Record<string, unknown> | null) || {};
  const slug = agent.web_slug as string | undefined;

  if (!slug) {
    await sendButtons(
      ctx.phone,
      "🌐 Web sayfanız henüz hazır değil. Önce profilinizi tamamlayın.",
      [
        { id: "cmd:profilduzenle", title: "🪪 Profil Düzenle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
    return;
  }

  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/web-sayfam?t=${token}`;
  const publicUrl = `${appUrl}/u/${slug}`;

  await sendUrlButton(
    ctx.phone,
    `🌐 *Web Sayfam*\n\nKişisel landing page'iniz hazır:\n${publicUrl}\n\nÖnizleme, kopyalama ve paylaşım için aşağıdaki butona tıklayın.`,
    "🌐 Paneli Aç",
    url,
    { skipNav: true },
  );
}
