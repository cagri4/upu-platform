/**
 * /tamamla — fills only the fields needed for sunum, not the full 30-step edit.
 *
 * Triggered from portal-add ("✏️ Tamamla" button) when scrape is incomplete.
 * Walks user through missing minimum fields + photo check, then hands off
 * to /sunum as the next corridor step.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendNavFooter } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// Order of checks — only prompt for missing ones.
type TamamlaStep = "title" | "price" | "area" | "rooms" | "neighborhood" | "photos" | "done";

const STEP_ORDER: TamamlaStep[] = ["title", "price", "area", "rooms", "neighborhood", "photos", "done"];

const MIN_PHOTOS = 3;

interface PropertyCore {
  id: string;
  title: string | null;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_neighborhood: string | null;
  photoCount: number;
}

async function loadProperty(userId: string, propertyId: string): Promise<PropertyCore | null> {
  const sb = getServiceClient();
  const { data: prop } = await sb
    .from("emlak_properties")
    .select("id, title, price, area, rooms, location_neighborhood")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!prop) return null;
  const { count } = await sb
    .from("emlak_property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  return {
    id: prop.id as string,
    title: prop.title as string | null,
    price: prop.price as number | null,
    area: prop.area as number | null,
    rooms: prop.rooms as string | null,
    location_neighborhood: prop.location_neighborhood as string | null,
    photoCount: count || 0,
  };
}

function firstMissingStep(p: PropertyCore): TamamlaStep {
  if (!p.title || p.title.trim().length < 3) return "title";
  if (!p.price || p.price <= 0) return "price";
  if (!p.area || p.area <= 0) return "area";
  if (!p.rooms) return "rooms";
  if (!p.location_neighborhood) return "neighborhood";
  if (p.photoCount < MIN_PHOTOS) return "photos";
  return "done";
}

async function promptStep(ctx: WaContext, step: TamamlaStep, propertyId: string): Promise<void> {
  switch (step) {
    case "title":
      await sendText(ctx.phone, "📌 *Başlık eksik*\n\nİlana uygun kısa bir başlık yaz:\n\nÖrnek: \"Yalıkavak Kiralık 2+1 Daire\"");
      break;
    case "price":
      await sendText(ctx.phone, "💰 *Fiyat eksik*\n\nFiyatı yaz:\n\nÖrnek: 4.5M, 25 bin, 750.000");
      break;
    case "area":
      await sendText(ctx.phone, "📐 *Metrekare eksik*\n\nBrüt metrekareyi yaz:\n\nÖrnek: 120");
      break;
    case "rooms":
      await sendButtons(ctx.phone, "🛏 *Oda sayısı eksik*", [
        { id: `tmm:rooms:${propertyId}:2+1`, title: "2+1" },
        { id: `tmm:rooms:${propertyId}:3+1`, title: "3+1" },
        { id: `tmm:rooms:${propertyId}:4+1`, title: "4+1" },
      ]);
      return; // sendButtons auto-nav; skip extra nav
    case "neighborhood":
      await sendText(ctx.phone, "📍 *Mahalle eksik*\n\nMahalleyi yaz:\n\nÖrnek: Yalıkavak, Bitez");
      break;
    case "photos": {
      // Start foto_upload session so incoming WhatsApp photos get saved
      await startSession(ctx.userId, ctx.tenantId, "foto_upload", "waiting_photo");
      await updateSession(ctx.userId, "waiting_photo", { propertyId, from_tamamla: true });
      await sendButtons(ctx.phone,
        `📷 *En az ${MIN_PHOTOS} fotoğraf gerekli*\n\nTelefonundan şimdi fotoğraf gönder (çek veya galeriden seç). Bitirince butona bas.`,
        [{ id: "foto_done", title: "✅ Bitti" }],
      );
      return;
    }
    case "done":
      await sendButtons(ctx.phone,
        "✨ *Tamam! Artık sunumunu hazırlatabilirim.*\n\nSeçilen mülk için sunum oluşturayım mı?",
        [{ id: "cmd:sunum", title: "📊 Sunumu Hazırla" }],
      );
      return;
  }
  await sendNavFooter(ctx.phone);
}

// Entry point: button id "tamamla:<propertyId>"
export async function handleTamamlaCallback(ctx: WaContext, data: string): Promise<void> {
  const propertyId = data.replace("tamamla:", "");
  const prop = await loadProperty(ctx.userId, propertyId);
  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "🏠 Menü" }]);
    return;
  }
  const next = firstMissingStep(prop);
  if (next === "done") {
    await promptStep(ctx, "done", propertyId);
    return;
  }
  await startSession(ctx.userId, ctx.tenantId, "tamamla", next);
  await updateSession(ctx.userId, next, { propertyId });
  await promptStep(ctx, next, propertyId);
}

// Text step handler — text inputs for title/price/area/neighborhood
export async function handleTamamlaStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim() || "";
  const d = (session.data as Record<string, unknown>) || {};
  const propertyId = d.propertyId as string;
  if (!propertyId) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Geçersiz oturum. Yeniden dene.", [{ id: "cmd:menu", title: "🏠 Menü" }]);
    return;
  }

  const step = session.current_step as TamamlaStep;
  const sb = getServiceClient();

  if (step === "title") {
    if (text.length < 3) {
      await sendText(ctx.phone, "Başlık en az 3 karakter olmalı. Tekrar yaz:");
      await sendNavFooter(ctx.phone);
      return;
    }
    await sb.from("emlak_properties").update({ title: text }).eq("id", propertyId).eq("user_id", ctx.userId);
  } else if (step === "price") {
    const price = parsePrice(text);
    if (!price) {
      await sendText(ctx.phone, "Geçerli fiyat yaz. Örnek: 4.5M, 25 bin, 750.000");
      await sendNavFooter(ctx.phone);
      return;
    }
    await sb.from("emlak_properties").update({ price }).eq("id", propertyId).eq("user_id", ctx.userId);
  } else if (step === "area") {
    const n = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!n || n < 1) {
      await sendText(ctx.phone, "Geçerli metrekare yaz:");
      await sendNavFooter(ctx.phone);
      return;
    }
    await sb.from("emlak_properties").update({ area: n }).eq("id", propertyId).eq("user_id", ctx.userId);
  } else if (step === "neighborhood") {
    if (!text) {
      await sendText(ctx.phone, "Mahalle boş olamaz. Yaz:");
      await sendNavFooter(ctx.phone);
      return;
    }
    await sb.from("emlak_properties").update({ location_neighborhood: text }).eq("id", propertyId).eq("user_id", ctx.userId);
  } else {
    // Unknown step fallback
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Beklenmedik adım.", [{ id: "cmd:menu", title: "🏠 Menü" }]);
    return;
  }

  // Advance to next missing step
  const prop = await loadProperty(ctx.userId, propertyId);
  if (!prop) {
    await endSession(ctx.userId);
    return;
  }
  const next = firstMissingStep(prop);
  if (next === "done") {
    await endSession(ctx.userId);
    await promptStep(ctx, "done", propertyId);
    return;
  }
  // For button-driven steps (rooms, photos), advance their callback/state inside promptStep
  if (next === "rooms" || next === "photos") {
    if (next === "rooms") {
      await updateSession(ctx.userId, "rooms", { propertyId });
    }
    // "photos" starts its own foto_upload session inside promptStep
    await promptStep(ctx, next, propertyId);
    return;
  }
  await updateSession(ctx.userId, next, { propertyId });
  await promptStep(ctx, next, propertyId);
}

// rooms button callback: "tmm:rooms:<propId>:<value>"
export async function handleTamamlaRooms(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");
  // ["tmm", "rooms", <propertyId>, <value>]
  const propertyId = parts[2];
  const value = parts[3];
  const sb = getServiceClient();
  await sb.from("emlak_properties").update({ rooms: value }).eq("id", propertyId).eq("user_id", ctx.userId);

  const prop = await loadProperty(ctx.userId, propertyId);
  if (!prop) {
    await sendButtons(ctx.phone, "Mülk bulunamadı.", [{ id: "cmd:menu", title: "🏠 Menü" }]);
    return;
  }
  const next = firstMissingStep(prop);
  if (next === "done") {
    await endSession(ctx.userId);
    await promptStep(ctx, "done", propertyId);
    return;
  }
  if (next === "photos") {
    await promptStep(ctx, "photos", propertyId);
    return;
  }
  await startSession(ctx.userId, ctx.tenantId, "tamamla", next);
  await updateSession(ctx.userId, next, { propertyId });
  await promptStep(ctx, next, propertyId);
}

// Simple price parser — matches mulk-ekle's parser
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}
