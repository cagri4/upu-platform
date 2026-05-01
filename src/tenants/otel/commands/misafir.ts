/**
 * Otel — misafir akışı (role='guest', lifetime).
 *
 * /misafirdavet (resepsiyon): yeni misafir profili oluştur (role='guest',
 * GUEST_PRESET, metadata.invited_for_hotel_id), invite_codes pending +
 * misafire WA üzerinden kod gönder. Misafir kod yazınca standart
 * invite_codes flow'u devreye girer (route.ts).
 *
 * Misafir komutları (5):
 *   rezervasyonum    — aktif rezervasyon detayları
 *   rezervasyonlarim — lifetime tarihçe (geçmiş + aktif + iptal)
 *   hizmetler        — otel hizmet listesi (kahvaltı, wifi, spa var/yok)
 *   wifi             — wifi şifresi + kullanım saati
 *   talep <metin>    — guest_request insert + resepsiyona bildirim
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";
import { GUEST_PRESET } from "@/tenants/otel/capabilities";
import { randomBytes } from "crypto";

function normalizePhone(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("0")) s = "90" + s.slice(1);
  return s;
}

// ── /misafirdavet — yeni misafir kayıt akışı (resepsiyon kullanır) ──────

export async function handleMisafirDavet(ctx: WaContext): Promise<void> {
  // Argüman parsing — "/misafirdavet 905551234567" veya buton ile session
  const text = ctx.text?.trim() || "";
  const argMatch = text.match(/(?:misafirdavet|davet)\s+(\d[\d\s]*)\s*(.*)?$/i);

  if (!argMatch) {
    // Tek-argüman akışını başlat
    await startSession(ctx.userId, ctx.tenantId, "misafirdavet", "waiting_phone");
    await sendText(ctx.phone, "👋 *Misafir Davet*\n\nMisafirin WhatsApp telefon numarasını yazın:\n\n_Örnek: 905321234567 veya 0532 123 45 67_\n\nİptal için: iptal");
    return;
  }

  await startMisafirInvite(ctx, argMatch[1], argMatch[2] || null);
}

export async function handleMisafirDavetStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Telefon numarasını yazın:"); return; }
  if (text.toLowerCase() === "iptal" || text.toLowerCase() === "vazgeç") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "İptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }
  await endSession(ctx.userId);
  await startMisafirInvite(ctx, text, null);
}

async function startMisafirInvite(ctx: WaContext, phoneRaw: string, rezId: string | null): Promise<void> {
  try {
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 8) {
      await sendButtons(ctx.phone, "❌ Geçersiz telefon numarası.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();

    // Resepsiyonist hangi otelde çalışıyor? hotel_employees veya owner ise
    // otel_user_hotels üzerinden bul.
    let hotelId: string | null = null;
    if (ctx.role === "admin") {
      const { data: ouh } = await supabase
        .from("otel_user_hotels")
        .select("hotel_id")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      hotelId = ouh?.hotel_id || null;
    } else {
      const { data: emp } = await supabase
        .from("hotel_employees")
        .select("hotel_id")
        .eq("profile_id", ctx.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      hotelId = emp?.hotel_id || null;
    }

    // Aynı telefonla mevcut guest profili var mı? (lifetime — varsa yeniden bağla)
    const { data: existingGuest } = await supabase
      .from("profiles")
      .select("id, display_name, tenant_id")
      .eq("whatsapp_phone", phone)
      .eq("role", "guest")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (existingGuest) {
      // Lifetime — varsa direkt sıcak karşılama, yeni davet kodu yok
      try {
        await sendButtons(phone,
          `🏨 *Tekrar hoş geldiniz, ${existingGuest.display_name || "değerli misafir"}!*\n\nOtelde size yardımcı olabileceğim. "menu" yazarak başlayın veya rezervasyonum komutuyla aktif rezervasyonunuzu görüntüleyin.`,
          [{ id: "cmd:menu", title: "📋 Menü" }],
        );
      } catch { /* ignore */ }
      await sendButtons(ctx.phone,
        `ℹ️ Bu misafir zaten kayıtlı (${existingGuest.display_name || phone}). Kendisine WA mesajı gönderildi.`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
      return;
    }

    // Yeni guest profili oluştur
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `otel_guest_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { source: "misafirdavet" },
    });
    if (authErr || !authUser.user) {
      console.error("[misafirdavet] auth err", authErr);
      await sendButtons(ctx.phone, "❌ Misafir oluşturulamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const inviteCode = randomBytes(3).toString("hex").toUpperCase();

    const { error: profErr } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      tenant_id: ctx.tenantId,
      display_name: "Misafir",  // checkin sonrası güncellenir
      role: "guest",
      capabilities: GUEST_PRESET,
      invited_by: ctx.userId,
      metadata: {
        invited_for_hotel_id: hotelId,
        reservation_id: rezId || null,
        marketing_opt_in: false,  // davet anında false; mekik check-in formunda opt-in tik
      },
    });
    if (profErr) {
      console.error("[misafirdavet] profile err", profErr);
      await sendButtons(ctx.phone, "❌ Profil oluşturulamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await supabase.from("invite_codes").insert({
      tenant_id: ctx.tenantId,
      user_id: authUser.user.id,
      code: inviteCode,
      status: "pending",
    });

    await supabase.from("subscriptions").insert({
      tenant_id: ctx.tenantId,
      user_id: authUser.user.id,
      plan: "guest",
      status: "active",
    });

    // Otel adı (welcome mesajı için)
    let hotelName = "otel";
    if (hotelId) {
      const { data: h } = await supabase.from("otel_hotels").select("name").eq("id", hotelId).maybeSingle();
      if (h?.name) hotelName = h.name;
    }

    // Misafire WA davet
    try {
      await sendButtons(phone,
        `🏨 *${hotelName}'e hoş geldiniz!*\n\nKayıt kodunuz: *${inviteCode}*\n\nKodu yazarak bağlanın — rezervasyonunuzu, otel hizmetlerini görüntüleyebilir, talepte bulunabilirsiniz.`,
        [{ id: "cmd:menu", title: "📋 Başla" }],
      );
    } catch (waErr) {
      console.error("[misafirdavet] WA invite failed:", waErr);
    }

    await sendButtons(ctx.phone,
      `✅ Misafir daveti gönderildi.\n\n📱 ${phone}\n🏨 ${hotelName}\n🔑 Kod: ${inviteCode}\n\nMisafir kodu yazınca aktifleşecek.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  } catch (err) {
    await handleError(ctx, "otel:misafirdavet", err, "db");
  }
}

// ── Misafir komutları (role='guest') ────────────────────────────────────

export async function handleRezervasyonum(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("id, room_id, check_in, check_out, status, total_price, pre_checkin_complete, otel_rooms(name)")
      .eq("guest_profile_id", ctx.userId)
      .gte("check_out", today)
      .order("check_in", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rez) {
      await sendButtons(ctx.phone,
        "ℹ️ Şu an aktif bir rezervasyonunuz görünmüyor.\n\nPersonelle iletişime geçmek için 'talep' yazabilirsiniz.",
        [
          { id: "cmd:rezervasyonlarim", title: "📜 Tarihçe" },
          { id: "cmd:menu", title: "Ana Menü" },
        ],
      );
      return;
    }

    const ci = new Date(rez.check_in).toLocaleDateString("tr-TR");
    const co = new Date(rez.check_out).toLocaleDateString("tr-TR");
    const roomName = (rez.otel_rooms as unknown as { name?: string } | null)?.name;
    const statusLabel = rez.status === "confirmed" ? "✅ Onaylı"
      : rez.status === "checked_in" ? "🟢 Konaklamada"
      : rez.status === "pending" ? "⏳ Beklemede"
      : rez.status;

    let text = `🏨 *Rezervasyonunuz*\n\n`;
    text += `📅 Giriş: ${ci}\n`;
    text += `📅 Çıkış: ${co}\n`;
    if (roomName) text += `🚪 Oda: ${roomName}\n`;
    text += `${statusLabel}\n`;
    if (rez.total_price) text += `💰 Toplam: ${rez.total_price}\n`;
    text += `\n${rez.pre_checkin_complete ? "✅ Online check-in tamamlandı" : "⚠️ Online check-in bekliyor"}`;

    const buttons: Array<{ id: string; title: string }> = [];
    if (!rez.pre_checkin_complete) buttons.push({ id: "cmd:cekin", title: "📝 Online Check-in" });
    buttons.push({ id: "cmd:hizmetler", title: "🛎 Hizmetler" });
    buttons.push({ id: "cmd:menu", title: "Ana Menü" });

    await sendButtons(ctx.phone, text, buttons.slice(0, 3));
  } catch (err) {
    await handleError(ctx, "otel:rezervasyonum", err, "db");
  }
}

export async function handleRezervasyonlarim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: rezs } = await supabase
      .from("otel_reservations")
      .select("id, check_in, check_out, status")
      .eq("guest_profile_id", ctx.userId)
      .order("check_in", { ascending: false })
      .limit(20);

    if (!rezs?.length) {
      await sendButtons(ctx.phone, "📜 Henüz rezervasyon geçmişi bulunmuyor.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = `📜 *Rezervasyon Tarihçeniz* (${rezs.length})\n\n`;
    for (const r of rezs) {
      const ci = new Date(r.check_in).toLocaleDateString("tr-TR");
      const co = new Date(r.check_out).toLocaleDateString("tr-TR");
      const icon = r.status === "checked_out" ? "✅"
        : r.status === "checked_in" ? "🟢"
        : r.status === "confirmed" ? "📅"
        : r.status === "cancelled" ? "❌"
        : "⏳";
      text += `${icon} ${ci} → ${co}\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:rezervasyonum", title: "📌 Aktif" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "otel:rezervasyonlarim", err, "db");
  }
}

async function getGuestHotelId(ctx: WaContext): Promise<string | null> {
  const supabase = getServiceClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ctx.userId)
    .maybeSingle();
  const meta = (prof?.metadata || {}) as Record<string, unknown>;
  return (meta.invited_for_hotel_id as string) || null;
}

export async function handleHizmetler(ctx: WaContext): Promise<void> {
  try {
    const hotelId = await getGuestHotelId(ctx);
    if (!hotelId) {
      await sendButtons(ctx.phone, "ℹ️ Otel bilgisi bulunamadı. Lütfen resepsiyona başvurun.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();
    const { data: hotel } = await supabase
      .from("otel_hotels")
      .select("name, location, metadata")
      .eq("id", hotelId)
      .maybeSingle();

    const meta = (hotel?.metadata || {}) as Record<string, unknown>;
    const breakfastTime = (meta.breakfast_time as string) || "07:00 - 10:30";
    const wifi = meta.wifi_ssid ? `Var (SSID: ${meta.wifi_ssid})` : "Var — şifre için 'wifi' yazın";
    const checkInTime = (meta.check_in_time as string) || "14:00";
    const checkOutTime = (meta.check_out_time as string) || "12:00";
    const reception = (meta.reception_phone as string) || "İç hat 0";

    let text = `🛎 *${hotel?.name || "Otel"} Hizmetleri*\n\n`;
    text += `🌅 Kahvaltı: ${breakfastTime}\n`;
    text += `🛜 Wi-Fi: ${wifi}\n`;
    text += `🔑 Check-in: ${checkInTime}'dan sonra\n`;
    text += `🚪 Check-out: ${checkOutTime}'a kadar\n`;
    text += `☎ Resepsiyon: ${reception}\n`;
    if (meta.spa_available) text += `💆 Spa & wellness: Mevcut\n`;
    if (meta.restaurant_available) text += `🍽 Restoran: Mevcut\n`;
    if (meta.pool_available) text += `🏊 Havuz: Mevcut\n`;

    await sendButtons(ctx.phone, text, [
      { id: "cmd:talep", title: "🆘 Talep / Yardım" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "otel:hizmetler", err, "db");
  }
}

export async function handleWifi(ctx: WaContext): Promise<void> {
  try {
    const hotelId = await getGuestHotelId(ctx);
    if (!hotelId) {
      await sendButtons(ctx.phone, "ℹ️ Otel bilgisi bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();
    const { data: hotel } = await supabase
      .from("otel_hotels")
      .select("name, metadata")
      .eq("id", hotelId)
      .maybeSingle();

    const meta = (hotel?.metadata || {}) as Record<string, unknown>;
    const ssid = (meta.wifi_ssid as string) || "—";
    const password = (meta.wifi_password as string) || "Resepsiyondan alınız";

    await sendButtons(ctx.phone,
      `🛜 *Wi-Fi Bilgileri*\n\n📡 SSID: *${ssid}*\n🔑 Şifre: *${password}*\n\nSorun yaşarsanız resepsiyona başvurun.`,
      [
        { id: "cmd:hizmetler", title: "🛎 Tüm Hizmetler" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    await handleError(ctx, "otel:wifi", err, "db");
  }
}

export async function handleTalep(ctx: WaContext): Promise<void> {
  // İnline argüman: /talep havlu eksik
  const text = ctx.text?.trim() || "";
  const m = text.match(/^talep\s+(.+)$/i);
  if (m && m[1].length > 3) {
    await submitTalep(ctx, m[1]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "talep", "waiting_message");
  await sendText(ctx.phone, "🆘 *Talep / Yardım*\n\nNe yapabilirim? Lütfen kısaca yazın:\n\n_Örnek: \"Havlu eksik, oda 204\"_\n\nİptal için: iptal");
}

export async function handleTalepStep(ctx: WaContext, _session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen talep metnini yazın:"); return; }
  if (text.toLowerCase() === "iptal" || text.toLowerCase() === "vazgeç") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "İptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }
  await endSession(ctx.userId);
  await submitTalep(ctx, text);
}

async function submitTalep(ctx: WaContext, message: string): Promise<void> {
  try {
    const hotelId = await getGuestHotelId(ctx);
    if (!hotelId) {
      await sendButtons(ctx.phone, "❌ Otel bilgisi bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();

    // Aktif rezervasyon — varsa request'e bağla
    const today = new Date().toISOString().slice(0, 10);
    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("id, room_id")
      .eq("guest_profile_id", ctx.userId)
      .lte("check_in", today)
      .gte("check_out", today)
      .maybeSingle();

    await supabase.from("otel_guest_requests").insert({
      tenant_id: ctx.tenantId,
      hotel_id: hotelId,
      guest_profile_id: ctx.userId,
      reservation_id: rez?.id || null,
      room_id: rez?.room_id || null,
      message,
      status: "open",
    });

    // Resepsiyona WA bildirim — GUESTS_VIEW yetkili kullanıcıları bul
    const { data: receptionists } = await supabase
      .from("profiles")
      .select("whatsapp_phone, capabilities")
      .eq("tenant_id", ctx.tenantId)
      .in("role", ["admin", "employee"])
      .not("whatsapp_phone", "is", null);

    const targetCap = "guests:view";
    const wildcard = "*";
    const targets = (receptionists || []).filter(r => {
      const caps = (r.capabilities as string[] | null) || [];
      return caps.includes(targetCap) || caps.includes(wildcard);
    });

    const guestLabel = ctx.userName || "Misafir";
    for (const t of targets) {
      try {
        await sendButtons(t.whatsapp_phone!,
          `🆘 *Yeni Misafir Talebi*\n\n👤 ${guestLabel}\n📱 ${ctx.phone}\n\n${message}`,
          [
            { id: "cmd:misafirler", title: "👥 Misafirler" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    await sendButtons(ctx.phone,
      `✅ Talebiniz alındı.\n\nResepsiyona iletildi, en kısa sürede size dönüş yapılacak.\n\n📋 Mesaj: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  } catch (err) {
    await handleError(ctx, "otel:talep", err, "db");
  }
}
