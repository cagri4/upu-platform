/**
 * Otel — online check-in (mekik akışı).
 *
 * /cekin (misafir komutu): aktif rezervasyon varsa 72h tokenized mekik
 *   link gönderir (form: kimlik foto + tercih + KVKK onay).
 * /cekinlink <rezId> (resepsiyon push): bir rezervasyon için linki
 *   manuel olarak misafire gönderir.
 *
 * Form'un kendisi web tarafında — bu modül sadece WA komut taraflarını
 * yönetir.
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { handleError } from "@/platform/whatsapp/error-handler";
import { randomBytes } from "crypto";

const TOKEN_TTL_HOURS = 72;
const MEKIK_PURPOSE = "otel-pre-checkin";

export async function generateCekinToken(profileId: string, reservationId: string): Promise<string> {
  const supabase = getServiceClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: profileId,
    token,
    expires_at: expiresAt,
    purpose: MEKIK_PURPOSE,
    metadata: { reservation_id: reservationId },
  });
  return token;
}

function getCekinUrl(token: string): string {
  const tenant = getTenantByKey("otel");
  const slug = tenant?.slug || "hotelai";
  return `https://${slug}.upudev.nl/tr/otel-cekin?t=${token}`;
}

// ── /cekin — misafir kendi check-in linkini ister ──────────────────────

export async function handleCekin(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("id, hotel_id, check_in, check_out, pre_checkin_complete")
      .eq("guest_profile_id", ctx.userId)
      .gte("check_out", today)
      .order("check_in", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rez) {
      await sendButtons(ctx.phone,
        "ℹ️ Aktif rezervasyon görünmüyor — online check-in yapmak için resepsiyona başvurun.",
        [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    if (rez.pre_checkin_complete) {
      await sendButtons(ctx.phone,
        "✅ Online check-in zaten tamamlandı. Otele geldiğinizde anahtar kartınız hazır olacak.",
        [
          { id: "cmd:rezervasyonum", title: "📌 Rezervasyon" },
          { id: "cmd:menu", title: "Ana Menü" },
        ],
      );
      return;
    }

    const token = await generateCekinToken(ctx.userId, rez.id);
    const url = getCekinUrl(token);

    await sendUrlButton(ctx.phone,
      `📝 *Online Check-in*\n\nKimlik fotoğrafı + tercihlerinizi paylaşıp otele varış öncesi formu tamamlayabilirsiniz. Otele geldiğinizde anahtar kartınız hazır olacak.\n\n_Link 72 saat geçerlidir._`,
      "📝 Formu Aç",
      url,
      { skipNav: true },
    );
  } catch (err) {
    await handleError(ctx, "otel:cekin", err, "db");
  }
}

// ── /cekinlink <rezId> — resepsiyon manuel push ────────────────────────

export async function handleCekinLink(ctx: WaContext): Promise<void> {
  const text = ctx.text?.trim() || "";
  const m = text.match(/cekinlink\s+([a-f0-9-]{8,})/i);
  if (!m) {
    await sendButtons(ctx.phone, "Kullanım: /cekinlink <rezervasyonId>\n\nİlgili rezervasyonun ID'sini yazın.", [
      { id: "cmd:rezervasyonlar", title: "📅 Rezervasyonlar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  try {
    const rezId = m[1];
    const supabase = getServiceClient();
    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("id, hotel_id, guest_name, guest_phone, guest_profile_id, check_in, check_out, pre_checkin_complete")
      .eq("id", rezId)
      .maybeSingle();

    if (!rez) {
      await sendButtons(ctx.phone, "❌ Rezervasyon bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    if (rez.pre_checkin_complete) {
      await sendButtons(ctx.phone, "ℹ️ Bu rezervasyon için online check-in zaten tamamlanmış.", [
        { id: "cmd:rezervasyonlar", title: "📅 Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    if (!rez.guest_profile_id) {
      await sendButtons(ctx.phone,
        `❌ Misafirin profil bağlantısı yok. Önce /misafirdavet ${rez.guest_phone || ""} ile davet gönderin.`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
      return;
    }

    if (!rez.guest_phone) {
      await sendButtons(ctx.phone, "❌ Misafirin telefonu kayıtlı değil.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const token = await generateCekinToken(rez.guest_profile_id, rez.id);
    const url = getCekinUrl(token);

    try {
      await sendUrlButton(rez.guest_phone,
        `📝 *Online Check-in*\n\nMerhaba ${rez.guest_name || "değerli misafir"}!\n\n${rez.check_in} tarihli konaklamanız için online check-in yapabilirsiniz. Kimlik fotoğrafı + tercihler — 2 dakika sürer.\n\n_Link 72 saat geçerlidir._`,
        "📝 Formu Aç",
        url,
        { skipNav: true },
      );
    } catch (waErr) {
      console.error("[otel:cekinlink] WA send failed:", waErr);
    }

    await sendButtons(ctx.phone,
      `✅ Check-in linki gönderildi.\n\n👤 ${rez.guest_name || rez.guest_phone}\n📱 ${rez.guest_phone}\n📅 ${rez.check_in}`,
      [
        { id: "cmd:rezervasyonlar", title: "📅 Rezervasyonlar" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    await handleError(ctx, "otel:cekinlink", err, "db");
  }
}
