/**
 * /musteriEkle — Step-by-step customer addition
 *
 * Flow: name -> phone -> listing_type (buttons) -> budget (text) -> location (text) -> INSERT
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Parse helpers ────────────────────────────────────────────────────

function parsePhone(text: string): string | null {
  const digits = text.replace(/[^\d+]/g, "");
  if (digits.length < 10) return null;
  return digits;
}

function parseBudget(text: string): { min: number | null; max: number | null } | null {
  const cleaned = text.replace(/TL/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".").trim().toLowerCase();

  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*([mk])?\s*[-–]\s*(\d+(?:\.\d+)?)\s*([mk])?$/i);
  if (rangeMatch) {
    let low = parseFloat(rangeMatch[1]);
    let high = parseFloat(rangeMatch[3]);
    const unit = (rangeMatch[2] || rangeMatch[4] || "").toLowerCase();
    if (unit === "m") { low *= 1_000_000; high *= 1_000_000; }
    else if (unit === "k") { low *= 1_000; high *= 1_000; }
    else if (low <= 500 && high <= 500) { low *= 1_000_000; high *= 1_000_000; }
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

function fmtBudget(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M TL`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}K TL`;
  return `${val} TL`;
}

// ── Command handler: /musteriEkle ────────────────────────────────────

export async function handleMusteriEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "musteriEkle", "name");
  await sendText(ctx.phone, "👤 Musterinizin adini ve soyadini yazin:");
}

// ── Step handler ─────────────────────────────────────────────────────

export async function handleMusteriEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) {
    await sendText(ctx.phone, "Lutfen bir deger yazin.");
    return;
  }

  switch (step) {
    case "name": {
      if (text.length < 2) {
        await sendText(ctx.phone, "Isim en az 2 karakter olmali. Tekrar yazin:");
        return;
      }
      await updateSession(ctx.userId, "phone", { name: text });
      await sendText(ctx.phone, "📱 Telefon numarasini yazin:\n\nOrnek: 0532 123 4567");
      return;
    }

    case "phone": {
      const phone = parsePhone(text);
      if (!phone) {
        await sendText(ctx.phone, "Gecerli bir telefon numarasi yazin. Ornek: 0532 123 4567");
        return;
      }
      await updateSession(ctx.userId, "listing_type", { phone });
      await sendButtons(ctx.phone, "🏷 Musteriniz ne ariyor?", [
        { id: "mustekle:lt:satilik", title: "Satilik" },
        { id: "mustekle:lt:kiralik", title: "Kiralik" },
        { id: "mustekle:lt:hepsi", title: "Hepsi" },
      ]);
      return;
    }

    case "budget": {
      if (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") {
        await updateSession(ctx.userId, "location", { budget_min: null, budget_max: null });
        await sendText(ctx.phone, "📍 Hangi bolgeleri tercih ediyor?\n\nVirgul ile ayirin: Bodrum, Bitez\n\nAtlamak icin \"gec\" yazin.");
        return;
      }
      const budget = parseBudget(text);
      if (!budget) {
        await sendText(ctx.phone, "Gecerli bir butce yazin.\n\nOrnek: 5M, 5-10M, 15K, 15-30K\n\nAtlamak icin \"gec\" yazin.");
        return;
      }
      await updateSession(ctx.userId, "location", { budget_min: budget.min, budget_max: budget.max });
      await sendText(ctx.phone, "📍 Hangi bolgeleri tercih ediyor?\n\nVirgul ile ayirin: Bodrum, Bitez\n\nAtlamak icin \"gec\" yazin.");
      return;
    }

    case "location": {
      let locations: string[] = [];
      if (text.toLowerCase() !== "gec" && text.toLowerCase() !== "geç") {
        locations = text.split(",").map(s => s.trim()).filter(Boolean);
      }
      await finalizeCustomer(ctx, locations);
      return;
    }

    default:
      await sendText(ctx.phone, "Lutfen yukaridaki butonlardan birini secin.");
      return;
  }
}

// ── Callback handler ─────────────────────────────────────────────────

export async function handleMusteriEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");

  if (data === "mustekle:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Musteri ekleme iptal edildi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  // Listing type: mustekle:lt:{value}
  if (parts[1] === "lt") {
    const value = parts[2];
    await updateSession(ctx.userId, "budget", { listing_type: value });
    const labelMap: Record<string, string> = { satilik: "Satilik", kiralik: "Kiralik", hepsi: "Hepsi" };
    await sendText(ctx.phone, `🏷 ${labelMap[value] || value} secildi.\n\n💰 Butcesini yazin (TL):\n\nOrnek: 5M, 5-10M, 15K, 15-30K\n\nAtlamak icin \"gec\" yazin.`);
  }
}

// ── Finalize ─────────────────────────────────────────────────────────

async function finalizeCustomer(ctx: WaContext, locations: string[]): Promise<void> {
  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!session) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Bir hata olustu. Lutfen tekrar deneyin.");
    return;
  }

  const d = session.data as Record<string, unknown>;

  const { error } = await supabase.from("emlak_customers").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    name: d.name,
    phone: d.phone,
    listing_type: d.listing_type,
    budget_min: d.budget_min || null,
    budget_max: d.budget_max || null,
    location: locations.length > 0 ? locations.join(", ") : null,
    status: "aktif",
  });

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "❌ Musteri eklenirken hata olustu.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const labelMap: Record<string, string> = { satilik: "Satilik", kiralik: "Kiralik", hepsi: "Hepsi" };
  let budgetStr = "";
  if (d.budget_min && d.budget_max) budgetStr = `💰 ${fmtBudget(d.budget_min as number)} — ${fmtBudget(d.budget_max as number)}\n`;
  else if (d.budget_max) budgetStr = `💰 ${fmtBudget(d.budget_max as number)}'e kadar\n`;

  await sendButtons(ctx.phone,
    `✅ Musteri basariyla eklendi!\n\n` +
    `👤 ${d.name}\n📱 ${d.phone}\n🏷 ${labelMap[d.listing_type as string] || d.listing_type}\n` +
    budgetStr +
    (locations.length > 0 ? `📍 ${locations.join(", ")}\n` : ""),
    [
      { id: "cmd:musterilerim", title: "Musterilerim" },
      { id: "cmd:menu", title: "Ana Menu" },
    ],
  );
}
