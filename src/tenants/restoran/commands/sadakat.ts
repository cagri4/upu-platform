/**
 * Sadakat club (müdavim) — komutlar
 *
 * Sahip / personel tarafı:
 *   /sadakat        — özet panosu (toplam üye, aktif, dormant, doğum günü)
 *   /sadakatlist    — listeleme (en son ziyaret azalan)
 *
 * Müşteri tarafı (capability yok):
 *   /uyeol          — multi-step: ad → doğum günü → onay
 *   /puanim         — kendi profili: kaç ziyaret, son ziyaret, favori
 *
 * Kayıt akışı (otel guest pattern uyarlama):
 *   1. Müşteri WA'dan "uye ol" yazar
 *   2. Bot "isminiz?" sorar → "doğum gününüz?" → "kayıt tamam"
 *   3. rst_loyalty_members'a guest_phone (WA gateway'den), guest_name,
 *      birthday, source: "wa_self" yazılır
 *   4. Sahip /sadakat komutuyla yeni üyeyi görür
 *
 * NOT: Müşteri = WA-only secondary user. profiles tablosunda kullanıcı
 * olarak yer almıyor (tenant kontekstinde "anonim" misafir). Bu MVP'de
 * router müşteri WA mesajını "anlamadım" fallback'ine atıyor; uyeol
 * handler bunu manuel komut olarak çalıştırıyor.
 */

import type { WaContext, StepHandler, CallbackHandler } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { formatCurrency } from "./helpers";

// ── /sadakat — sahip için özet panosu ──────────────────────────────────

export async function handleSadakat(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10).slice(5);  // "MM-DD"
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();

    const [totalRes, activeRes, dormantRes, birthdayRes, topSpenderRes, recentJoinRes] = await Promise.all([
      supabase.from("rst_loyalty_members").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("is_active", true),
      supabase.from("rst_loyalty_members").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("is_active", true).gte("last_visit_at", twoWeeksAgo),
      supabase.from("rst_loyalty_members").select("id, guest_name, last_visit_at, visit_count").eq("tenant_id", ctx.tenantId).eq("is_active", true).gte("visit_count", 5).lt("last_visit_at", twoWeeksAgo).order("last_visit_at").limit(5),
      supabase.from("rst_loyalty_members").select("id, guest_name").eq("tenant_id", ctx.tenantId).eq("is_active", true).eq("birthday", today).limit(5),
      supabase.from("rst_loyalty_members").select("guest_name, total_spent, visit_count").eq("tenant_id", ctx.tenantId).eq("is_active", true).order("total_spent", { ascending: false }).limit(3),
      supabase.from("rst_loyalty_members").select("guest_name, created_at").eq("tenant_id", ctx.tenantId).eq("is_active", true).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(3),
    ]);

    const total = totalRes.count || 0;
    const active = activeRes.count || 0;
    const dormant = dormantRes.data || [];
    const birthdays = birthdayRes.data || [];
    const top = topSpenderRes.data || [];
    const recent = recentJoinRes.data || [];

    if (total === 0) {
      await sendButtons(ctx.phone,
        `💝 *Sadakat Club*\n\nHenüz müdavim kaydı yok.\n\nMüşterilerinizi davet edin: \`/sadakat-davet\` ile QR linki üretin.`,
        [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const lines: string[] = [];
    lines.push(`💝 *Sadakat Club*`);
    lines.push("");
    lines.push(`👥 Toplam: *${total}* üye  ·  Aktif (2 hf): *${active}*`);
    lines.push("");

    if (birthdays.length > 0) {
      lines.push(`🎂 *Bugün doğum günü*`);
      for (const m of birthdays) lines.push(`   • ${m.guest_name}`);
      lines.push("");
    }

    if (dormant.length > 0) {
      lines.push(`💤 *Geri çağırma adayları*`);
      for (const m of dormant) {
        const days = Math.floor((Date.now() - new Date(m.last_visit_at).getTime()) / 86400000);
        lines.push(`   • ${m.guest_name} — ${days} gün, ${m.visit_count} ziyaret`);
      }
      lines.push("");
    }

    if (top.length > 0) {
      lines.push(`🏆 *En çok harcayan*`);
      for (const m of top) {
        lines.push(`   • ${m.guest_name} — ${formatCurrency(m.total_spent || 0)} (${m.visit_count} ziyaret)`);
      }
      lines.push("");
    }

    if (recent.length > 0) {
      lines.push(`✨ *Bu hafta katılan*`);
      for (const m of recent) lines.push(`   • ${m.guest_name}`);
      lines.push("");
    }

    await sendButtons(ctx.phone, lines.join("\n"), [
      { id: "cmd:sadakatlist", title: "📋 Tüm Üyeler" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    console.error("[restoran:sadakat] error:", err);
    await sendText(ctx.phone, "Sadakat verisi yüklenirken bir hata oluştu.");
  }
}

// ── /sadakatlist — tüm üye listesi (compact) ───────────────────────────

export async function handleSadakatList(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: members } = await supabase
      .from("rst_loyalty_members")
      .select("guest_name, guest_phone, visit_count, total_spent, last_visit_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(20);

    if (!members?.length) {
      await sendText(ctx.phone, "Henüz müdavim kaydı yok.");
      return;
    }

    const lines = members.map(m => {
      const lastVisit = m.last_visit_at
        ? new Date(m.last_visit_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
        : "-";
      return `• *${m.guest_name}* — ${m.visit_count}× · ${formatCurrency(m.total_spent || 0)} · ${lastVisit}`;
    });

    await sendButtons(ctx.phone,
      `💝 *Müdavimler* (${members.length})\n\n${lines.join("\n")}`,
      [
        { id: "cmd:sadakat", title: "📊 Özet" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
  } catch (err) {
    console.error("[restoran:sadakatlist] error:", err);
    await sendText(ctx.phone, "Liste yüklenirken hata oluştu.");
  }
}

// ── /uyeol — müşteri kayıt akışı ────────────────────────────────────────

interface UyeOlData {
  guest_name?: string;
  birthday?: string;     // "MM-DD"
}

export async function handleUyeOl(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Zaten üye mi kontrol et
  const { data: existing } = await supabase
    .from("rst_loyalty_members")
    .select("id, guest_name, visit_count, total_spent")
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_phone", ctx.phone.startsWith("+") ? ctx.phone : `+${ctx.phone}`)
    .maybeSingle();

  if (existing) {
    await sendButtons(ctx.phone,
      `Zaten üyemiziniz! 💝\n\n` +
      `${existing.guest_name} — ${existing.visit_count} ziyaret\n` +
      `Toplam: ${formatCurrency(existing.total_spent || 0)}\n\n` +
      `Detay için: \`puanim\``,
      [
        { id: "cmd:puanim", title: "⭐ Puanım" },
        { id: "cmd:menukalemleri", title: "📋 Menü" },
      ]);
    return;
  }

  await startSession(ctx.userId || ctx.phone, ctx.tenantId, "uyeol", "guest_name");
  await sendText(ctx.phone,
    `🎉 *Sadakat Club'a Hoş Geldiniz*\n\n` +
    `Müdavim olun, sizi tanıyalım — özel günlerinizde sürpriz mesaj, ` +
    `geçmiş siparişiniz, kişisel öneriler.\n\n` +
    `Adınız ve soyadınız?\n\n_İptal: \`iptal\`_`);
}

export const handleUyeOlStep: StepHandler = async (ctx, session) => {
  if (session.command !== "uyeol") return;
  const text = ctx.text.trim();
  const lower = text.toLowerCase();
  const userIdKey = ctx.userId || ctx.phone;

  if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
    await endSession(userIdKey);
    await sendText(ctx.phone, "Kayıt iptal edildi. Daha sonra tekrar deneyebilirsiniz.");
    return;
  }

  const data = session.data as UyeOlData;

  if (session.current_step === "guest_name") {
    if (text.length < 2) {
      await sendText(ctx.phone, "Lütfen adınızı yazın. Örnek: _Ali Yılmaz_");
      return;
    }
    await updateSession(userIdKey, "birthday", { guest_name: text });
    await sendButtons(ctx.phone,
      `Tamam ${text.split(" ")[0]} 👋\n\n` +
      `Doğum gününüzü öğrenebilir miyiz? (gün.ay — örn: 15.6)\n\n` +
      `_Özel günde sürpriz için. Yıl tutmuyoruz._`,
      [{ id: "uyeol:skip-bday", title: "Atla" }]);
    return;
  }

  if (session.current_step === "birthday") {
    const m = text.match(/^(\d{1,2})[\.\/](\d{1,2})$/);
    if (!m) {
      await sendText(ctx.phone, "Tarih formatı: gün.ay (örn: 15.6)");
      return;
    }
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      await sendText(ctx.phone, "Geçersiz tarih.");
      return;
    }
    const bday = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    await finalizeUyeOl(ctx, { ...data, birthday: bday });
  }
};

export const handleUyeOlCallback: CallbackHandler = async (ctx, callbackData) => {
  const userIdKey = ctx.userId || ctx.phone;
  const session = await getSession(userIdKey);
  if (!session || session.command !== "uyeol") return;
  const action = callbackData.replace(/^uyeol:/, "");

  if (action === "skip-bday") {
    await finalizeUyeOl(ctx, session.data as UyeOlData);
  }
};

async function finalizeUyeOl(ctx: WaContext, data: UyeOlData): Promise<void> {
  const supabase = getServiceClient();
  const userIdKey = ctx.userId || ctx.phone;
  const phone = ctx.phone.startsWith("+") ? ctx.phone : `+${ctx.phone}`;

  if (!data.guest_name) {
    await endSession(userIdKey);
    await sendText(ctx.phone, "Eksik bilgi. Tekrar deneyin: \`uyeol\`");
    return;
  }

  const { error } = await supabase
    .from("rst_loyalty_members")
    .insert({
      tenant_id: ctx.tenantId,
      guest_phone: phone,
      guest_name: data.guest_name,
      birthday: data.birthday || null,
      first_visit_at: new Date().toISOString(),
      visit_count: 0,
      total_spent: 0,
      marketing_opt_in: true,
      source: "wa_self",
      is_active: true,
    });

  await endSession(userIdKey);

  if (error) {
    if (error.code === "23505") {
      await sendText(ctx.phone, "Zaten üyeyiz. \`puanim\` ile profilinizi görebilirsiniz.");
    } else {
      await sendText(ctx.phone, `Kayıt oluşturulamadı: ${error.message}`);
    }
    return;
  }

  await sendButtons(ctx.phone,
    `✨ *Hoş geldiniz ${data.guest_name.split(" ")[0]}!*\n\n` +
    `Sadakat Club'ımıza katıldınız 💝\n\n` +
    `📋 Menüyü görmek için: \`menu\`\n` +
    `📅 Rezervasyon için bize yazın\n` +
    `⭐ Profilinizi görmek için: \`puanim\``,
    [
      { id: "cmd:menukalemleri", title: "📋 Menü" },
      { id: "cmd:puanim", title: "⭐ Puanım" },
    ]);
}

// ── /puanim — müşteri kişisel profil ───────────────────────────────────

export async function handlePuanim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const phone = ctx.phone.startsWith("+") ? ctx.phone : `+${ctx.phone}`;

  const { data: member } = await supabase
    .from("rst_loyalty_members")
    .select("guest_name, visit_count, total_spent, last_visit_at, favorite_items, birthday, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("guest_phone", phone)
    .maybeSingle();

  if (!member) {
    await sendButtons(ctx.phone,
      `Henüz üyemiz değilsiniz.\n\n` +
      `\`uye ol\` yazarak Sadakat Club'a katılabilirsiniz — özel günler, sürpriz, kişisel öneriler.`,
      [
        { id: "cmd:uyeol", title: "🎉 Üye Ol" },
        { id: "cmd:menukalemleri", title: "📋 Menü" },
      ]);
    return;
  }

  const lastVisit = member.last_visit_at
    ? new Date(member.last_visit_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
    : "İlk ziyaretiniz";
  const memberSince = new Date(member.created_at).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const favs = (member.favorite_items as string[] | null) || [];

  const lines: string[] = [];
  lines.push(`⭐ *${member.guest_name}*`);
  lines.push("");
  lines.push(`📊 ${member.visit_count} ziyaret  ·  ${formatCurrency(member.total_spent || 0)}`);
  lines.push(`📅 Son ziyaret: ${lastVisit}`);
  lines.push(`✨ Üyelik: ${memberSince}`);
  if (member.birthday) lines.push(`🎂 Doğum günü: ${member.birthday.split("-").reverse().join(".")}`);
  if (favs.length > 0) {
    lines.push("");
    lines.push(`💚 *Favorileriniz*`);
    for (const f of favs) lines.push(`   • ${f}`);
  }

  await sendButtons(ctx.phone, lines.join("\n"), [
    { id: "cmd:menukalemleri", title: "📋 Menü" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}
