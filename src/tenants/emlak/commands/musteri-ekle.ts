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
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

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
  // Yeni davranış: WA içi step-by-step yerine magic link → web form.
  // Eski step handler kodu (handleMusteriEkleStep / Callback) duruyor ama
  // tetiklenmiyor.
  const { sendUrlButton } = await import("@/platform/whatsapp/send");
  const { randomBytes } = await import("crypto");
  const supabase = getServiceClient();

  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const url = `${appUrl}/tr/musteri-ekle-form?t=${token}`;

  await sendUrlButton(
    ctx.phone,
    `🤝 *Müşteri Ekle*\n\nMüşterinizin bilgilerini ve aradığı kriterleri form üzerinden ekleyin. Kayıt sonrası size bilgi mesajı gönderirim.`,
    "🤝 Formu Aç",
    url,
    { skipNav: true },
  );
}

// ── Step handler ─────────────────────────────────────────────────────

export async function handleMusteriEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  switch (step) {
    case "name": {
      if (text.length < 2) {
        await sendText(ctx.phone, "İsim en az 2 karakter olmalı. Tekrar yazın:");
        return;
      }
      await updateSession(ctx.userId, "phone", { name: text });
      await sendText(ctx.phone, "📱 Telefon numarasını yazın:\n\nOrnek: 0532 123 4567");
      return;
    }

    case "phone": {
      const phone = parsePhone(text);
      if (!phone) {
        await sendText(ctx.phone, "Geçerli bir telefon numarası yazın. Ornek: 0532 123 4567");
        return;
      }
      await updateSession(ctx.userId, "listing_type", { phone });
      await sendButtons(ctx.phone, "🏷 Müşteriniz ne arıyor?", [
        { id: "mustekle:lt:satilik", title: "Satılık" },
        { id: "mustekle:lt:kiralik", title: "Kiralık" },
        { id: "mustekle:lt:hepsi", title: "Hepsi" },
      ]);
      return;
    }

    case "rooms": {
      if (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") {
        await updateSession(ctx.userId, "budget", { rooms: null });
      } else {
        await updateSession(ctx.userId, "budget", { rooms: text.trim() });
      }
      await sendText(ctx.phone, "💰 Bütçesini yazın (TL):\n\nÖrnek: 5M, 5-10M, 15K, 15-30K\n\nAtlamak için \"gec\" yazın.");
      return;
    }

    case "budget": {
      if (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") {
        await updateSession(ctx.userId, "location", { budget_min: null, budget_max: null });
      } else {
        const budget = parseBudget(text);
        if (!budget) {
          await sendText(ctx.phone, "Geçerli bir bütçe yazın.\n\nÖrnek: 5M, 5-10M, 15K, 15-30K\n\nAtlamak için \"gec\" yazın.");
          return;
        }
        await updateSession(ctx.userId, "location", { budget_min: budget.min, budget_max: budget.max });
      }
      await sendText(ctx.phone, "📍 Hangi bölgeleri tercih ediyor?\n\nVirgül ile ayırın: Bodrum, Bitez\n\nAtlamak için \"gec\" yazın.");
      return;
    }

    case "location": {
      let locations: string[] = [];
      if (text.toLowerCase() !== "gec" && text.toLowerCase() !== "geç") {
        locations = text.split(",").map(s => s.trim()).filter(Boolean);
      }
      await updateSession(ctx.userId, "notes", { location: locations.join(", ") || null });
      await sendText(ctx.phone, "📝 Müşteri hakkında not eklemek ister misiniz?\n\nÖrnek: Acil arıyor, deniz manzarası şart\n\nAtlamak için \"gec\" yazın.");
      return;
    }

    case "notes": {
      const notes = (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") ? null : text.trim();
      await finalizeCustomer(ctx, notes);
      return;
    }

    default:
      await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
      return;
  }
}

// ── Callback handler ─────────────────────────────────────────────────

export async function handleMusteriEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");

  if (data === "mustekle:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Müşteri ekleme iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Listing type: mustekle:lt:{value}
  if (parts[1] === "lt") {
    const value = parts[2];
    await updateSession(ctx.userId, "property_type", { listing_type: value });
    const labelMap: Record<string, string> = { satilik: "Satılık", kiralik: "Kiralık", hepsi: "Hepsi" };
    await sendButtons(ctx.phone, `🏷 ${labelMap[value] || value} seçildi.\n\n🏠 Ne tür mülk arıyor?`, [
      { id: "mustekle:pt:daire", title: "Daire" },
      { id: "mustekle:pt:villa", title: "Villa" },
      { id: "mustekle:pt:hepsi", title: "Hepsi" },
    ]);
  }

  // Property type: mustekle:pt:{value}
  if (parts[1] === "pt") {
    const value = parts[2];
    const types = value === "hepsi" ? [] : [value];
    await updateSession(ctx.userId, "rooms", { property_type: types });
    await sendText(ctx.phone, "🛏 Oda sayısı tercihi?\n\nÖrnek: 3+1, 2+1\n\nAtlamak için \"gec\" yazın.");
  }
}

// ── Finalize ─────────────────────────────────────────────────────────

async function finalizeCustomer(ctx: WaContext, notes: string | null): Promise<void> {
  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!session) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Bir hata oluştu. Lütfen tekrar deneyin.");
    return;
  }

  const d = session.data as Record<string, unknown>;

  const { error } = await supabase.from("emlak_customers").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    name: d.name,
    phone: d.phone,
    listing_type: d.listing_type,
    property_type: (d.property_type as string[])?.length ? d.property_type : null,
    rooms: d.rooms || null,
    budget_min: d.budget_min || null,
    budget_max: d.budget_max || null,
    location: d.location || null,
    notes: notes,
    status: "aktif",
  });

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "❌ Müşteri eklenirken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const labelMap: Record<string, string> = { satilik: "Satılık", kiralik: "Kiralık", hepsi: "Hepsi" };
  let budgetStr = "";
  if (d.budget_min && d.budget_max) budgetStr = `💰 ${fmtBudget(d.budget_min as number)} — ${fmtBudget(d.budget_max as number)}\n`;
  else if (d.budget_max) budgetStr = `💰 ${fmtBudget(d.budget_max as number)}'e kadar\n`;

  const ptLabels: Record<string, string> = { daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Müstakil", rezidans: "Rezidans" };
  const ptArr = d.property_type as string[] | null;
  const ptStr = ptArr?.length ? ptArr.map(t => ptLabels[t] || t).join(", ") : "";

  // Plain text success — router's silent trigger handles XP.
  // No side-exit buttons to avoid corridor breaks.
  let successMsg = `✅ Müşteri başarıyla eklendi!\n\n` +
    `👤 ${d.name}\n📱 ${d.phone}\n🏷 ${labelMap[d.listing_type as string] || d.listing_type}\n` +
    (ptStr ? `🏠 ${ptStr}\n` : "") +
    (d.rooms ? `🛏 ${d.rooms}\n` : "") +
    budgetStr +
    (d.location ? `📍 ${d.location}\n` : "") +
    (notes ? `📝 ${notes}\n` : "");

  // Check for property matches — append info as text, no extra buttons
  try {
    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, price, listing_type")
      .eq("user_id", ctx.userId)
      .limit(100);

    if (properties?.length) {
      const custListingType = d.listing_type as string;
      const custBudgetMax = d.budget_max as number | null;
      const matches = properties.filter((p) => {
        if (custListingType && custListingType !== "hepsi" && p.listing_type !== custListingType) return false;
        if (custBudgetMax && p.price > custBudgetMax) return false;
        return true;
      });
      if (matches.length > 0) {
        successMsg += `\n🏠 ${matches.length} mülkünüz yeni müşterinize uygun!`;
      }
    }
  } catch { /* don't break main flow */ }

  await sendText(ctx.phone, successMsg);
  await logEvent(ctx.tenantId, ctx.userId, "musteri_ekle", `${d.name}`);

}
