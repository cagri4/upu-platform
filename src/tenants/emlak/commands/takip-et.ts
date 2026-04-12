/**
 * /takipEt — Market tracking alerts setup
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

function parseBudget(text: string): { min: number | null; max: number | null } | null {
  const cleaned = text.replace(/TL/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".").trim().toLowerCase();
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*([mk])?\s*[-–]\s*(\d+(?:\.\d+)?)\s*([mk])?$/i);
  if (rangeMatch) {
    let low = parseFloat(rangeMatch[1]);
    let high = parseFloat(rangeMatch[3]);
    const unit = (rangeMatch[2] || rangeMatch[4] || "").toLowerCase();
    if (unit === "m") { low *= 1_000_000; high *= 1_000_000; }
    else if (unit === "k") { low *= 1_000; high *= 1_000; }
    return { min: Math.round(low), max: Math.round(high) };
  }
  const unitMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*([mk])$/i);
  if (unitMatch) {
    const num = parseFloat(unitMatch[1]);
    const mult = unitMatch[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
    return { min: null, max: Math.round(num * mult) };
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 100) return null;
  return { min: null, max: Math.round(num) };
}

export async function handleTakipEt(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("emlak_monitoring_criteria")
    .select("id, criteria, is_active")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)
    .limit(5);

  if (existing && existing.length > 0) {
    let text = `📡 Aktif Takipleriniz (${existing.length})\n\n`;
    for (const [i, c] of existing.entries()) {
      const criteria = c.criteria as Record<string, unknown> || {};
      text += `${i + 1}. ${(criteria.listing_type as string) || "Tümü"} | ${(criteria.locations as string[])?.join(", ") || "Tüm bölgeler"}\n`;
    }
    text += "\nHer sabah 08:00'de yeni ilanlar taranır.";

    await sendButtons(ctx.phone, text, [
      { id: "tkp:new", title: "Yeni Takip" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  await startNewTracking(ctx);
}

async function startNewTracking(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "takipEt", "listing_type");

  await sendButtons(ctx.phone, "📡 Yeni Piyasa Takibi\n\n🏷 Ne tür ilanları takip etmek istiyorsunuz?", [
    { id: "tkp:lt:satilik", title: "Satılık" },
    { id: "tkp:lt:kiralik", title: "Kiralık" },
    { id: "tkp:lt:hepsi", title: "Hepsi" },
  ]);
}

export async function handleTakipEtStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) return;

  if (step === "budget") {
    if (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") {
      await updateSession(ctx.userId, "location", { budget_min: null, budget_max: null });
      await sendText(ctx.phone, "📍 Hangi bölgeleri takip etmek istiyorsunuz?\n\nÖrnek: Bodrum, Yalıkavak\n\nAtlamak için \"gec\" yazin.");
      return;
    }
    const budget = parseBudget(text);
    if (!budget) {
      await sendText(ctx.phone, "Geçerli bütçe yazın. Örnek: 5M, 5-10M\n\nAtlamak için \"gec\" yazin.");
      return;
    }
    await updateSession(ctx.userId, "location", { budget_min: budget.min, budget_max: budget.max });
    await sendText(ctx.phone, "📍 Hangi bölgeleri takip etmek istiyorsunuz?\n\nÖrnek: Bodrum, Yalıkavak\n\nAtlamak için \"gec\" yazin.");
    return;
  }

  if (step === "location") {
    let locations: string[] = [];
    if (text.toLowerCase() !== "gec" && text.toLowerCase() !== "geç") {
      locations = text.split(",").map(s => s.trim()).filter(Boolean);
    }
    await updateSession(ctx.userId, "confirm", { locations });
    await createTracking(ctx);
    return;
  }
}

export async function handleTakipEtCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "tkp:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Takip iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  if (data === "tkp:new") {
    await startNewTracking(ctx);
    return;
  }

  const parts = data.split(":");

  // Listing type
  if (parts[1] === "lt") {
    const value = parts[2];
    await updateSession(ctx.userId, "budget", { listing_type: value });
    const labelMap: Record<string, string> = { satilik: "Satılık", kiralik: "Kiralık", hepsi: "Hepsi" };
    await sendText(ctx.phone, `🏷 ${labelMap[value] || value} seçildi.\n\n💰 Bütçe aralığı (TL):\n\nÖrnek: 3M, 3-8M\n\nAtlamak için \"gec\" yazin.`);
    return;
  }
}

async function createTracking(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Oturum süresi doldu. Tekrar /takipEt yazın.");
    return;
  }

  const d = sess.data as Record<string, unknown>;
  const locations = (d.locations as string[]) || [];

  const { error } = await supabase.from("emlak_monitoring_criteria").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    criteria: {
      listing_type: d.listing_type,
      budget_min: d.budget_min,
      budget_max: d.budget_max,
      locations,
    },
    is_active: true,
  });

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "❌ Takip oluşturulurken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await sendText(ctx.phone,
    `✅ Piyasa takibi başlatıldı!\n\nHer sabah 08:00'de yeni ilanlar taranacak ve size bildirilecek.`,
  );
  await logEvent(ctx.tenantId, ctx.userId, "takip_et", "yeni takip oluşturuldu");
}
