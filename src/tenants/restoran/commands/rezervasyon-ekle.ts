/**
 * /rezervasyonekle — Yeni rezervasyon multi-step flow.
 *
 * Adımlar:
 *   1. guest_name      — ad soyad
 *   2. party_size      — kaç kişi
 *   3. day             — bugün / yarın / diğer
 *   4. day_custom      — (sadece "diğer" seçilirse) gün/ay
 *   5. time            — saat (hh:mm)
 *   6. notes           — özel istek (opsiyonel)
 *   7. confirm         — özet + onay
 *
 * Phone opsiyonel: WA'dan ekleyen sahip/personel kendisi yazıyorsa
 * zaten WA gateway numarası bilinir, ama ekleme tarafında müşterinin
 * telefon numarasını kaydetmek istiyoruz → 1 ekstra "phone" adımı eklenir.
 *
 * Telefon: ad/kişi/gün/saat sırasında telefonu da soruyoruz, ama akışı
 * dağıtmamak için "ad" adımıyla aynı mesajda alınamadığı için bayi'nin
 * "talimat" pattern'ini taklit ediyoruz: phone adımını telefon ID prefix
 * "phone:" olarak ayrıca soruyoruz.
 *
 * NOT: bu komut sadece sahip/personel için. Müşteri WA'sında çalışmaz —
 * router capability gate ile filtrelenir (`reservations:manage`).
 */

import type { WaContext, StepHandler, CallbackHandler } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { shortTime, RESERVATION_STATUS_ICON } from "./helpers";

interface ReservationData {
  guest_name?: string;
  guest_phone?: string;
  party_size?: number;
  day_iso?: string;       // "YYYY-MM-DD"
  day_label?: string;     // human-readable: "Bugün", "Yarın", "5 Mayıs"
  time_str?: string;      // "HH:mm"
  notes?: string;
}

export async function handleRezervasyonEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "rezervasyonekle", "guest_name");
  await sendText(ctx.phone,
    `📅 *Yeni Rezervasyon*\n\nMisafirin adı ve soyadı?\n\n_İptal etmek için: \`iptal\`_`);
}

export const handleRezervasyonEkleStep: StepHandler = async (ctx, session) => {
  if (session.command !== "rezervasyonekle") return;

  const text = ctx.text.trim();
  const lower = text.toLowerCase();
  if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Rezervasyon ekleme iptal edildi.", [
      { id: "cmd:rezervasyon", title: "📅 Rezervasyonlar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const data = session.data as ReservationData;

  switch (session.current_step) {
    case "guest_name": {
      if (text.length < 2) {
        await sendText(ctx.phone, "Lütfen adı ve soyadı yazın. Örnek: _Ali Yılmaz_");
        return;
      }
      await updateSession(ctx.userId, "guest_phone", { guest_name: text });
      await sendButtons(ctx.phone,
        `Telefon numarası? (E.164 formatında, örn: +31612345678)\n\n_Bilinmiyorsa "atla" yazın._`,
        [{ id: "rez:skip-phone", title: "Atla" }]);
      return;
    }
    case "guest_phone": {
      let phone: string | null = null;
      if (lower !== "atla" && text.length > 5) {
        // Basit normalize: + ile başlamıyorsa "+" ekle
        phone = text.startsWith("+") ? text : `+${text.replace(/[^0-9]/g, "")}`;
      }
      await updateSession(ctx.userId, "party_size", { ...data, guest_phone: phone || undefined });
      await sendText(ctx.phone, `Kaç kişi?\n\n_Sadece sayı: 4_`);
      return;
    }
    case "party_size": {
      const n = parseInt(text, 10);
      if (isNaN(n) || n < 1 || n > 50) {
        await sendText(ctx.phone, "Lütfen geçerli bir kişi sayısı girin (1-50).");
        return;
      }
      await updateSession(ctx.userId, "day", { ...data, party_size: n });
      await sendButtons(ctx.phone, `Hangi gün?`, [
        { id: "rez:day-today",    title: "Bugün" },
        { id: "rez:day-tomorrow", title: "Yarın" },
        { id: "rez:day-custom",   title: "Başka gün" },
      ]);
      return;
    }
    case "day_custom": {
      // Format: dd.mm veya dd.mm.yyyy
      const m = text.match(/^(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?$/);
      if (!m) {
        await sendText(ctx.phone, "Tarih formatı: gün.ay  (örn: 5.5 veya 5.5.2026)");
        return;
      }
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const yearGiven = m[3] ? parseInt(m[3], 10) : NaN;
      const now = new Date();
      let year: number;
      if (!isNaN(yearGiven)) {
        year = yearGiven < 100 ? 2000 + yearGiven : yearGiven;
      } else {
        year = now.getFullYear();
        // Geçmiş bir tarihse otomatik gelecek yıla taşı
        const candidate = new Date(year, month, day);
        if (candidate < now) year++;
      }
      const target = new Date(year, month, day, 0, 0, 0, 0);
      if (isNaN(target.getTime())) {
        await sendText(ctx.phone, "Geçersiz tarih.");
        return;
      }
      const dayIso = target.toISOString().slice(0, 10);
      const dayLabel = target.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
      await updateSession(ctx.userId, "time", { ...data, day_iso: dayIso, day_label: dayLabel });
      await sendText(ctx.phone, `Saat? (örn: 19:30 veya 1930)`);
      return;
    }
    case "time": {
      const m = text.match(/^(\d{1,2})[:\.]?(\d{2})?$/);
      if (!m) {
        await sendText(ctx.phone, "Saat formatı: hh:mm (örn: 19:30)");
        return;
      }
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2] || "0", 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        await sendText(ctx.phone, "Geçersiz saat.");
        return;
      }
      const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      await updateSession(ctx.userId, "notes", { ...data, time_str: timeStr });
      await sendButtons(ctx.phone,
        `Özel istek var mı? (Doğum günü, vejetaryen menü, sessiz köşe, vb.)\n\n_Yoksa "atla" yazın._`,
        [{ id: "rez:skip-notes", title: "Atla" }]);
      return;
    }
    case "notes": {
      const notes = lower === "atla" ? undefined : text;
      await updateSession(ctx.userId, "confirm", { ...data, notes });
      await sendConfirmation(ctx, { ...data, notes });
      return;
    }
  }
};

async function sendConfirmation(ctx: WaContext, data: ReservationData): Promise<void> {
  const lines: string[] = [];
  lines.push(`📋 *Rezervasyon Özeti*`);
  lines.push("");
  lines.push(`👤 ${data.guest_name}`);
  if (data.guest_phone) lines.push(`📱 ${data.guest_phone}`);
  lines.push(`👥 ${data.party_size} kişi`);
  lines.push(`📅 ${data.day_label} • ${data.time_str}`);
  if (data.notes) lines.push(`📝 ${data.notes}`);
  lines.push("");
  lines.push(`Onaylıyor musunuz?`);

  await sendButtons(ctx.phone, lines.join("\n"), [
    { id: "rez:confirm", title: "✅ Onayla" },
    { id: "rez:cancel",  title: "❌ İptal" },
  ]);
}

export const handleRezervasyonEkleCallback: CallbackHandler = async (ctx, callbackData) => {
  const supabase = getServiceClient();
  const { getSession } = await import("@/platform/whatsapp/session");
  const session = await getSession(ctx.userId);
  if (!session || session.command !== "rezervasyonekle") return;
  const data = session.data as ReservationData;
  const action = callbackData.replace(/^rez:/, "");

  // ── Skip helpers ────────────────────────────────────────────────
  if (action === "skip-phone") {
    await updateSession(ctx.userId, "party_size", { ...data });
    await sendText(ctx.phone, `Kaç kişi?\n\n_Sadece sayı: 4_`);
    return;
  }
  if (action === "skip-notes") {
    await updateSession(ctx.userId, "confirm", { ...data });
    await sendConfirmation(ctx, data);
    return;
  }

  // ── Day picker ──────────────────────────────────────────────────
  if (action.startsWith("day-")) {
    if (action === "day-today") {
      const t = new Date();
      const iso = t.toISOString().slice(0, 10);
      await updateSession(ctx.userId, "time", { ...data, day_iso: iso, day_label: "Bugün" });
      await sendText(ctx.phone, `Saat? (örn: 19:30 veya 1930)`);
      return;
    }
    if (action === "day-tomorrow") {
      const t = new Date(); t.setDate(t.getDate() + 1);
      const iso = t.toISOString().slice(0, 10);
      await updateSession(ctx.userId, "time", { ...data, day_iso: iso, day_label: "Yarın" });
      await sendText(ctx.phone, `Saat? (örn: 19:30 veya 1930)`);
      return;
    }
    if (action === "day-custom") {
      await updateSession(ctx.userId, "day_custom", { ...data });
      await sendText(ctx.phone, `Tarih? (gün.ay — örn: 5.5 veya 5.5.2026)`);
      return;
    }
  }

  // ── Confirm / Cancel ────────────────────────────────────────────
  if (action === "cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Rezervasyon iptal edildi.", [
      { id: "cmd:rezervasyon", title: "📅 Rezervasyonlar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  if (action === "confirm") {
    if (!data.guest_name || !data.party_size || !data.day_iso || !data.time_str) {
      await sendText(ctx.phone, "Eksik bilgi var, baştan deneyin: `rezervasyonekle`");
      await endSession(ctx.userId);
      return;
    }
    const reservedAt = new Date(`${data.day_iso}T${data.time_str}:00`);
    if (isNaN(reservedAt.getTime())) {
      await sendText(ctx.phone, "Tarih/saat hatası.");
      await endSession(ctx.userId);
      return;
    }

    // Loyalty member match (varsa otomatik bağla)
    let loyaltyMemberId: string | null = null;
    if (data.guest_phone) {
      const { data: member } = await supabase
        .from("rst_loyalty_members")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("guest_phone", data.guest_phone)
        .maybeSingle();
      if (member) loyaltyMemberId = member.id as string;
    }

    const { data: inserted, error } = await supabase
      .from("rst_reservations")
      .insert({
        tenant_id: ctx.tenantId,
        guest_name: data.guest_name,
        guest_phone: data.guest_phone || null,
        party_size: data.party_size,
        reserved_at: reservedAt.toISOString(),
        duration_minutes: 90,
        status: "confirmed",
        source: "wa",
        notes: data.notes || null,
        loyalty_member_id: loyaltyMemberId,
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    await endSession(ctx.userId);

    if (error || !inserted) {
      await sendText(ctx.phone, `❌ Rezervasyon kaydedilemedi: ${error?.message || "bilinmeyen hata"}`);
      return;
    }

    const time = shortTime(reservedAt.toISOString());
    const memberNote = loyaltyMemberId ? "\n\n💝 Müdavim olarak tanıdım — geçmiş ziyaretler güncellendi." : "";
    await sendButtons(ctx.phone,
      `${RESERVATION_STATUS_ICON.confirmed} *Rezervasyon kaydedildi*\n\n` +
      `${data.guest_name} • ${data.party_size} kişi\n` +
      `${data.day_label} • ${time}` +
      (data.notes ? `\n📝 ${data.notes}` : "") +
      memberNote,
      [
        { id: "cmd:rezervasyon", title: "📅 Tüm Rezervasyonlar" },
        { id: "cmd:rezervasyonekle", title: "➕ Yeni Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
  }
};
