/**
 * /mulklerim — kullanıcının portföyündeki mülkleri kart layout'ta açar.
 * Magic-link → /tr/mulklerim sayfası, kartlarda Düzenle / Sil butonları.
 */

import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton, sendButtons } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export async function handleMulklerim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Aktif (silinmemiş) mülk var mı?
  const { count } = await supabase
    .from("emlak_properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .neq("status", "deleted");

  if (!count) {
    await sendButtons(ctx.phone, "📁 Henüz portföyünüzde mülk yok.", [
      { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/mulklerim?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `📁 *Mülklerim*\n\nPortföyünüzde *${count} mülk* var. Aşağıdaki butondan tüm mülkleri görüntüleyebilir, kart üzerindeki düzenle/sil butonlarıyla yönetebilirsiniz.`,
    "📁 Mülkleri Aç",
    url,
    { skipNav: true },
  );
}
