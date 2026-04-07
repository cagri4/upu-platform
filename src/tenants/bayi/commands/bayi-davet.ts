/**
 * /bayidavet — Çoklu kullanımlık bayi davet linki oluştur
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

export async function handleBayiDavet(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin" && ctx.role !== "user") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");

    // Check if active invite link already exists
    const { data: existing } = await supabase
      .from("bayi_invite_links")
      .select("id, code, used_count, is_active")
      .eq("created_by", ctx.userId)
      .eq("is_active", true)
      .eq("role", "dealer")
      .maybeSingle();

    if (existing) {
      const whatsappLink = `https://wa.me/31644967207?text=${encodeURIComponent(`Merhaba! Bayi Yönetim Sistemine kayıt olmak istiyorum. Davet Kodum: BAYI:${existing.code}`)}`;

      await sendButtons(ctx.phone,
        `🏪 *Mevcut Bayi Davet Linki*\n\n` +
        `📋 Kod: *${existing.code}*\n` +
        `👥 Kullanım: ${existing.used_count} bayi kayıt oldu\n\n` +
        `🔗 Link:\n${whatsappLink}\n\n` +
        `Bu linki bayilerinize gönderin. Tıklayıp kayıt olacaklar.`,
        [
          { id: "cmd:bayidurum", title: "📋 Bayi Durumu" },
          { id: "cmd:menu", title: "Ana Menü" },
        ],
      );
      return;
    }

    // Create new invite link
    const code = randomBytes(4).toString("hex").toUpperCase();

    await supabase.from("bayi_invite_links").insert({
      tenant_id: ctx.tenantId,
      created_by: ctx.userId,
      code,
      role: "dealer",
      permissions: {},
      max_uses: null, // unlimited
      is_active: true,
    });

    const whatsappLink = `https://wa.me/31644967207?text=${encodeURIComponent(`Merhaba! Bayi Yönetim Sistemine kayıt olmak istiyorum. Davet Kodum: BAYI:${code}`)}`;

    await sendButtons(ctx.phone,
      `✅ *Bayi Davet Linki Oluşturuldu!*\n\n` +
      `📋 Kod: *${code}*\n` +
      `♾️ Sınırsız kullanım\n\n` +
      `🔗 Link:\n${whatsappLink}\n\n` +
      `Bu linki bayilerinize gönderin. Her bayi tıklayıp kayıt olacak.\n` +
      `Kayıt olan bayiler otomatik olarak sisteminize eklenir.`,
      [
        { id: "cmd:bayidurum", title: "📋 Bayi Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    await handleError(ctx, "bayi:bayidavet", err, "db");
  }
}
