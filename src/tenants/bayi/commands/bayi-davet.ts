/**
 * /bayidavet — Çoklu kullanımlık bayi davet linki oluştur
 *
 * Faz 4: country-aware mesajlama. NL kullanıcıya KvK numarası vurgulu
 * (Hollanda B2B'de KvK doğrulaması yaygın), TR kullanıcıya Vergi No.
 * Davet mesajı bayinin diline (firma profili Hollanda ise NL/TR çift,
 * Türkiye ise TR) ileri faz Faz 7'de — şu an ortak Türkçe.
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

const BOT_PHONE = "31644967207";

async function getOwnerCountry(userId: string): Promise<string> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const localeSettings = (meta.tenant_locale || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;
  return (
    (localeSettings.country as string) ||
    (firma.country as string) ||
    "NL"
  );
}

function buildInviteMessage(country: string, code: string): string {
  if (country === "NL" || country === "BE" || country === "DE") {
    return `Merhaba! Bayi Yönetim Sistemine kayıt olmak istiyorum.\n` +
      `KvK numaramla başvuru yapacağım.\n\n` +
      `Davet Kodum: BAYI:${code}`;
  }
  return `Merhaba! Bayi Yönetim Sistemine kayıt olmak istiyorum.\n` +
    `Vergi numaramla başvuru yapacağım.\n\n` +
    `Davet Kodum: BAYI:${code}`;
}

export async function handleBayiDavet(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin" && ctx.role !== "user") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");
    const country = await getOwnerCountry(ctx.userId);
    const idHint = (country === "NL" || country === "BE" || country === "DE") ? "KvK" : "Vergi No";

    // Check if active invite link already exists
    const { data: existing } = await supabase
      .from("bayi_invite_links")
      .select("id, code, used_count, is_active")
      .eq("created_by", ctx.userId)
      .eq("is_active", true)
      .eq("role", "dealer")
      .maybeSingle();

    if (existing) {
      const inviteText = buildInviteMessage(country, existing.code);
      const whatsappLink = `https://wa.me/${BOT_PHONE}?text=${encodeURIComponent(inviteText)}`;

      await sendButtons(ctx.phone,
        `🏪 *Mevcut Bayi Davet Linki*\n\n` +
        `📋 Kod: *${existing.code}*\n` +
        `👥 Kullanım: ${existing.used_count} bayi kayıt oldu\n` +
        `🆔 Aday başvuru: ${idHint} numarası\n\n` +
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

    const inviteText = buildInviteMessage(country, code);
    const whatsappLink = `https://wa.me/${BOT_PHONE}?text=${encodeURIComponent(inviteText)}`;

    await sendButtons(ctx.phone,
      `✅ *Bayi Davet Linki Oluşturuldu!*\n\n` +
      `📋 Kod: *${code}*\n` +
      `♾️ Sınırsız kullanım\n` +
      `🆔 Aday başvuru: ${idHint} numarası ile\n\n` +
      `🔗 Link:\n${whatsappLink}\n\n` +
      `Bu linki bayilerinize gönderin. Her bayi tıklayıp kayıt olacak.\n` +
      `Kayıt olan bayiler otomatik olarak sisteminize eklenir.`,
      [
        { id: "cmd:bayidurum", title: "📋 Bayi Durumu" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );

    // Discovery chain step 3: bayi davet linki üretildi → kampanya magic link
    try {
      const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
      await advanceDiscovery(ctx.userId, ctx.tenantKey, ctx.phone, "bayi_davet_olusturuldu");
    } catch { /* don't break flow */ }
  } catch (err) {
    await handleError(ctx, "bayi:bayidavet", err, "db");
  }
}
