/**
 * Müşteri Takip — satış pipeline yönetimi
 *
 * Danışman müşterileriyle olan iletişimini kaydeder,
 * pipeline aşamasını günceller, takip hatırlatmaları alır.
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

const PIPELINE_STAGES: Record<string, { label: string; emoji: string; order: number }> = {
  yeni: { label: "Yeni", emoji: "🆕", order: 1 },
  ilk_temas: { label: "İlk Temas", emoji: "📞", order: 2 },
  sunum_yapildi: { label: "Sunum Yapıldı", emoji: "🎯", order: 3 },
  gosterim: { label: "Gösterim", emoji: "🏠", order: 4 },
  teklif: { label: "Teklif Verildi", emoji: "💰", order: 5 },
  pazarlik: { label: "Pazarlık", emoji: "🤝", order: 6 },
  kapandi: { label: "Satış Kapandı", emoji: "✅", order: 7 },
  iptal: { label: "İptal", emoji: "❌", order: 8 },
};

const CONTACT_TYPES = [
  { id: "mt:ct:arama", title: "📞 Arama yaptım" },
  { id: "mt:ct:mesaj", title: "💬 Mesaj gönderdim" },
  { id: "mt:ct:gosterim", title: "🏠 Ev gösterdim" },
  { id: "mt:ct:teklif", title: "💰 Teklif verdim" },
];

const CONTACT_RESULTS = [
  { id: "mt:rs:ilgili", title: "✅ İlgili" },
  { id: "mt:rs:dusunuyor", title: "🤔 Düşünüyor" },
  { id: "mt:rs:gorusme", title: "📅 Görüşme planlandı" },
  { id: "mt:rs:ilgisiz", title: "❌ İlgisiz" },
];

// ── Entry: müşteri listesi ──────────────────────────────────────────

export async function handleMusteriTakip(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, pipeline_stage, last_contact_date, next_followup_date")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("next_followup_date", { ascending: true, nullsFirst: true })
      .limit(10);

    if (!customers || customers.length === 0) {
      await sendText(ctx.phone, "Henüz müşteriniz yok. Önce müşteri ekleyin.");
      return;
    }

    // Takip gereken müşteriler önce
    const now = new Date();
    let msg = "📞 *Müşteri Takip*\n\n";

    const overdue = customers.filter(c => c.next_followup_date && new Date(c.next_followup_date) <= now);
    if (overdue.length > 0) {
      msg += `⚠️ *${overdue.length} müşteri takip bekliyor:*\n`;
      for (const c of overdue) {
        const stage = PIPELINE_STAGES[c.pipeline_stage] || PIPELINE_STAGES.yeni;
        const days = Math.floor((now.getTime() - new Date(c.next_followup_date).getTime()) / 86400000);
        msg += `${stage.emoji} ${c.name} — ${days} gün gecikmiş\n`;
      }
      msg += "\n";
    }

    const rows = customers.map(c => {
      const stage = PIPELINE_STAGES[c.pipeline_stage] || PIPELINE_STAGES.yeni;
      const lastContact = c.last_contact_date
        ? `Son: ${Math.floor((now.getTime() - new Date(c.last_contact_date).getTime()) / 86400000)} gün önce`
        : "Henüz temas yok";
      return {
        id: `mt:select:${c.id}`,
        title: `${stage.emoji} ${c.name}`.substring(0, 24),
        description: `${stage.label} · ${lastContact}`.substring(0, 72),
      };
    });

    await sendList(ctx.phone, msg + "Müşteri seçin:", "Müşteriler", [
      { title: "Müşterileriniz", rows },
    ]);
  } catch (err) {
    await handleError(ctx, "emlak:musteriTakip", err, "db");
  }
}

// ── Callback handler ────────────────────────────────────────────────

export async function handleMusteriTakipCallback(ctx: WaContext, data: string): Promise<void> {
  const supabase = getServiceClient();

  // Müşteri seçildi → aksiyon menüsü
  if (data.startsWith("mt:select:")) {
    const customerId = data.replace("mt:select:", "");
    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("id, name, pipeline_stage, last_contact_date, contact_count, notes")
      .eq("id", customerId)
      .eq("user_id", ctx.userId)
      .single();

    if (!customer) {
      await sendText(ctx.phone, "Müşteri bulunamadı.");
      return;
    }

    const stage = PIPELINE_STAGES[customer.pipeline_stage] || PIPELINE_STAGES.yeni;
    const lastDays = customer.last_contact_date
      ? `${Math.floor((Date.now() - new Date(customer.last_contact_date).getTime()) / 86400000)} gün önce`
      : "Henüz yok";

    let msg = `👤 *${customer.name}*\n\n`;
    msg += `${stage.emoji} Aşama: ${stage.label}\n`;
    msg += `📞 Toplam temas: ${customer.contact_count || 0}\n`;
    msg += `🕐 Son temas: ${lastDays}\n`;
    if (customer.notes) msg += `📝 Not: ${customer.notes}\n`;

    await sendButtons(ctx.phone, msg, [
      { id: `mt:contact:${customerId}`, title: "📞 Temas Kaydet" },
      { id: `mt:stage:${customerId}`, title: "📊 Aşama Güncelle" },
    ]);
    return;
  }

  // Temas kaydet → tip sor
  if (data.startsWith("mt:contact:")) {
    const customerId = data.replace("mt:contact:", "");
    const buttons = CONTACT_TYPES.map(t => ({
      ...t,
      id: `${t.id}:${customerId}`,
    }));
    // WhatsApp max 3 button — iki mesajda gönder
    await sendButtons(ctx.phone, "Ne tür bir temas yaptınız?", buttons.slice(0, 3));
    if (buttons.length > 3) {
      await sendButtons(ctx.phone, "veya:", buttons.slice(3));
    }
    return;
  }

  // Temas tipi seçildi → sonuç sor
  if (data.startsWith("mt:ct:")) {
    const parts = data.split(":");
    const contactType = parts[2]; // arama, mesaj, gosterim, teklif
    const customerId = parts[3];

    // Sonuç sor
    const buttons = CONTACT_RESULTS.map(r => ({
      ...r,
      id: `${r.id}:${contactType}:${customerId}`,
    }));
    await sendButtons(ctx.phone, "Sonuç nasıldı?", buttons.slice(0, 3));
    if (buttons.length > 3) {
      await sendButtons(ctx.phone, "veya:", buttons.slice(3));
    }
    return;
  }

  // Sonuç seçildi → kaydet
  if (data.startsWith("mt:rs:")) {
    const parts = data.split(":");
    const result = parts[2]; // ilgili, dusunuyor, gorusme, ilgisiz
    const contactType = parts[3];
    const customerId = parts[4];

    // Temas kaydı oluştur
    await supabase.from("emlak_customer_contacts").insert({
      customer_id: customerId,
      user_id: ctx.userId,
      contact_type: contactType,
      result,
    });

    // Müşteri güncelle
    const now = new Date().toISOString();
    const nextFollowup = getNextFollowupDate(result);
    const newStage = getNewStage(contactType, result);

    const updateData: Record<string, unknown> = {
      last_contact_date: now,
      next_followup_date: nextFollowup,
      updated_at: now,
    };
    if (newStage) updateData.pipeline_stage = newStage;

    // Increment contact_count
    const { data: current } = await supabase
      .from("emlak_customers")
      .select("contact_count")
      .eq("id", customerId)
      .single();

    updateData.contact_count = (current?.contact_count || 0) + 1;

    await supabase.from("emlak_customers").update(updateData).eq("id", customerId);

    const stageInfo = newStage ? `\n${PIPELINE_STAGES[newStage].emoji} Aşama: ${PIPELINE_STAGES[newStage].label}` : "";
    const followupDays = nextFollowup ? `\n⏰ Sonraki takip: ${Math.ceil((new Date(nextFollowup).getTime() - Date.now()) / 86400000)} gün sonra` : "";

    await sendText(ctx.phone,
      `✅ Temas kaydedildi!${stageInfo}${followupDays}`,
    );

    await logEvent(ctx.tenantId, ctx.userId, "musteri_takip", `${contactType} — ${result}`);

    return;
  }

  // Aşama güncelle → liste göster
  if (data.startsWith("mt:stage:")) {
    const customerId = data.replace("mt:stage:", "");
    const rows = Object.entries(PIPELINE_STAGES)
      .filter(([key]) => key !== "iptal")
      .map(([key, val]) => ({
        id: `mt:setstage:${key}:${customerId}`,
        title: `${val.emoji} ${val.label}`,
        description: "",
      }));

    await sendList(ctx.phone, "Yeni aşama seçin:", "Aşama Seç", [
      { title: "Pipeline", rows },
    ]);
    return;
  }

  // Aşama seçildi → güncelle
  if (data.startsWith("mt:setstage:")) {
    const parts = data.split(":");
    const stage = parts[2];
    const customerId = parts[3];

    await supabase.from("emlak_customers").update({
      pipeline_stage: stage,
      updated_at: new Date().toISOString(),
    }).eq("id", customerId);

    const stageInfo = PIPELINE_STAGES[stage];
    await sendText(ctx.phone, `✅ Aşama güncellendi: ${stageInfo.emoji} ${stageInfo.label}`);
    return;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function getNextFollowupDate(result: string): string | null {
  const now = Date.now();
  const day = 86400000;
  switch (result) {
    case "ilgili": return new Date(now + 3 * day).toISOString(); // 3 gün sonra takip
    case "dusunuyor": return new Date(now + 7 * day).toISOString(); // 1 hafta sonra
    case "gorusme": return new Date(now + 2 * day).toISOString(); // 2 gün sonra
    case "ilgisiz": return null; // takip yok
    default: return new Date(now + 7 * day).toISOString();
  }
}

function getNewStage(contactType: string, result: string): string | null {
  if (result === "ilgisiz") return "iptal";
  if (result === "gorusme") return "gosterim";
  if (contactType === "teklif") return "teklif";
  if (contactType === "gosterim") return "gosterim";
  if (contactType === "arama" || contactType === "mesaj") return "ilk_temas";
  return null;
}
