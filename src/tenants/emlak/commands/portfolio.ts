/**
 * /tara, /ekle — Portal URL scan and quick property add
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { startSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";
import type { CommandSession } from "@/platform/whatsapp/session";

// ── Portal detection ────────────────────────────────────────────────

type PortalType = "sahibinden" | "hepsiemlak" | "emlakjet" | "unknown";

function detectPortal(url: string): PortalType {
  const lower = url.toLowerCase();
  if (lower.includes("sahibinden.com") || lower.includes("shbd.io")) return "sahibinden";
  if (lower.includes("hepsiemlak.com")) return "hepsiemlak";
  if (lower.includes("emlakjet.com")) return "emlakjet";
  return "unknown";
}

function extractListingId(url: string, portal: PortalType): string | null {
  try {
    if (portal === "sahibinden") {
      // Full URL: sahibinden.com/ilan/...-1234567890/detay
      const match = url.match(/[-/](\d{7,12})(?:\/|$|\?)/);
      if (match) return match[1];
      // Short URL: sahibinden.com/s/PgkwG6Eh or shbd.io/s/PgkwG6Eh
      const shortMatch = url.match(/\/s\/([A-Za-z0-9]+)/);
      if (shortMatch) return `s_${shortMatch[1]}`;
      return null;
    }
    if (portal === "hepsiemlak") {
      const match = url.match(/-(\d+)(?:\/|$|\?)/);
      return match ? match[1] : null;
    }
    if (portal === "emlakjet") {
      const match = url.match(/\/ilan\/(\d+)/);
      return match ? match[1] : null;
    }
  } catch { /* ignore */ }
  return null;
}

// ── /tara — Scan portal URL ──────────────────────────────────────────

export async function handleTara(ctx: WaContext): Promise<void> {
  const args = ctx.text.split(" ").slice(1).join(" ").trim();

  if (!args) {
    await startSession(ctx.userId, ctx.tenantId, "tara", "waiting_url");
    await sendText(ctx.phone, "🔍 Portal linkini yapıştırın:\n\nÖrnek: https://sahibinden.com/ilan/...");
    const { sendNavFooter } = await import("@/platform/whatsapp/send");
    await sendNavFooter(ctx.phone);
    return;
  }

  await processPortalUrl(ctx, args);
}

export async function handleTaraStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendButtons(ctx.phone, "Geçerli bir portal linki yapıştırın.", [
      { id: "cmd:mulkekle", title: "🔙 Mülk Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  if (text.startsWith("http") || text.includes("sahibinden") || text.includes("shbd.io") || text.includes("hepsiemlak") || text.includes("emlakjet")) {
    await endSession(ctx.userId);
    await processPortalUrl(ctx, text);
    return;
  }

  await sendButtons(ctx.phone, "Geçerli bir portal linki yapıştırın.\n\nOrnek: https://sahibinden.com/ilan/...", [
    { id: "cmd:mulkekle", title: "🔙 Mülk Ekle" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

async function resolveShortUrl(url: string): Promise<string> {
  // Follow redirects until we reach a /ilan/ URL or run out of hops.
  // shbd.io → sahibinden.com/s/CODE → sahibinden.com/ilan/...
  let current = url;
  const maxHops = 5;
  for (let i = 0; i < maxHops; i++) {
    if (current.includes("/ilan/")) return current;
    const isShort = current.includes("shbd.io") || /sahibinden\.com\/s\//.test(current);
    if (!isShort) return current;
    try {
      const res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      const loc = res.headers.get("location");
      if (!loc) return current;
      current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
    } catch {
      return current;
    }
  }
  return current;
}

// ── Parse Sahibinden URL for property info ──────────────────────────

interface UrlParsedInfo {
  listing_type: string | null;
  type: string | null;
  rooms: string | null;
  location: string | null;
  title: string | null;
}

function parseSahibindenUrl(url: string): UrlParsedInfo {
  const result: UrlParsedInfo = { listing_type: null, type: null, rooms: null, location: null, title: null };

  try {
    // URL format: /ilan/emlak-konut-satilik-turgutreis-...-2-plus1-daire-1306005343/detay
    const path = new URL(url).pathname;
    const slug = path.replace("/ilan/", "").replace("/detay", "").replace(/\/+$/, "");
    const parts = slug.split("-");

    // listing_type: satilik / kiralik
    if (parts.includes("satilik")) result.listing_type = "satilik";
    else if (parts.includes("kiralik")) result.listing_type = "kiralik";

    // type: daire, villa, arsa, mustakil, rezidans, etc.
    const typeMap: Record<string, string> = {
      daire: "daire", villa: "villa", arsa: "arsa", mustakil: "mustakil",
      rezidans: "rezidans", yazlik: "yazlik", bina: "bina", depo: "depo",
      dukkan: "dukkan", ofis: "buro_ofis", isyeri: "isyeri",
    };
    for (const p of parts) {
      if (typeMap[p]) { result.type = typeMap[p]; break; }
    }

    // rooms: look for patterns like "2-plus1", "3-plus-1", "1-plus0"
    const roomMatch = slug.match(/(\d)\s*[-]?\s*plus\s*[-]?\s*(\d)/i);
    if (roomMatch) result.rooms = `${roomMatch[1]}+${roomMatch[2]}`;

    // location: after satilik/kiralik, before property details
    // e.g. "emlak-konut-satilik-turgutreis-havuzlu-..." → turgutreis
    const ltIndex = Math.max(parts.indexOf("satilik"), parts.indexOf("kiralik"));
    if (ltIndex >= 0 && ltIndex + 1 < parts.length) {
      // Next part after satilik/kiralik is usually the location
      const locPart = parts[ltIndex + 1];
      // Skip if it's a number or common word
      if (locPart && locPart.length > 2 && !/^\d+$/.test(locPart)) {
        result.location = locPart.charAt(0).toUpperCase() + locPart.slice(1);
      }
    }

    // title: build from slug, clean up
    const idMatch = slug.match(/-(\d{7,12})$/);
    let titleSlug = idMatch ? slug.replace(/-\d{7,12}$/, "") : slug;
    // Remove category prefix (emlak-konut-)
    titleSlug = titleSlug.replace(/^emlak-konut-/, "").replace(/^emlak-/, "");
    // Remove listing type
    titleSlug = titleSlug.replace(/^(satilik|kiralik)-/, "");
    // Replace dashes with spaces, capitalize
    const titleWords = titleSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1));
    // Replace "plus" with "+"
    result.title = titleWords.join(" ").replace(/(\d)\s*Plus\s*(\d)/gi, "$1+$2");
  } catch { /* ignore parse errors */ }

  return result;
}

async function processPortalUrl(ctx: WaContext, rawUrl: string): Promise<void> {
  // Resolve short URLs first
  const url = await resolveShortUrl(rawUrl);
  const portal = detectPortal(url);

  if (portal === "unknown") {
    await sendButtons(ctx.phone, "❌ Desteklenmeyen portal. Sahibinden, Hepsiemlak veya Emlakjet linki girin.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const sourceId = extractListingId(url, portal);
  const displayPortal = portal.charAt(0).toUpperCase() + portal.slice(1);
  const supabase = getServiceClient();

  // Check duplicate
  if (sourceId) {
    const { data: existing } = await supabase
      .from("emlak_properties")
      .select("id, title")
      .eq("source_id", sourceId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existing) {
      await sendButtons(ctx.phone, `⚠️ Bu ilan zaten portfoyunuzde!\n\n📌 ${existing.title}`, [
        { id: `mulkdetay:${existing.id}`, title: "Detay Gör" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }
  }

  // Parse URL for property info (baseline from slug)
  const parsed = portal === "sahibinden" ? parseSahibindenUrl(url) : { listing_type: null, type: null, rooms: null, location: null, title: null };

  // For sahibinden, also try full-page scrape via ScrapingBee proxy (bypass CF + TR IP)
  let scraped: Awaited<ReturnType<typeof import("@/platform/scraping/sahibinden").scrapeSahibindenListing>> = null;
  if (portal === "sahibinden" && url.includes("/ilan/")) {
    await sendText(ctx.phone, "🔍 İlan bilgileri çekiliyor... (birkaç saniye)");
    try {
      const { scrapeSahibindenListing } = await import("@/platform/scraping/sahibinden");
      scraped = await scrapeSahibindenListing(url);
    } catch (err) {
      console.error("[portfolio:scrape]", err);
    }
  }

  const title = scraped?.title || parsed.title || `${displayPortal} İlanı (${sourceId || "?"})`;

  // Insert property with parsed + scraped info
  const { data: newProp, error } = await supabase
    .from("emlak_properties")
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      title,
      source_url: url,
      source_portal: portal,
      source_id: sourceId || null,
      status: "aktif",
      type: parsed.type || "daire",
      listing_type: parsed.listing_type || "satilik",
      rooms: scraped?.rooms || parsed.rooms || null,
      price: scraped?.price ?? null,
      area: scraped?.area ?? null,
      net_area: scraped?.net_area ?? null,
      floor: scraped?.floor ?? null,
      total_floors: scraped?.total_floors ?? null,
      building_age: scraped?.building_age ?? null,
      heating: scraped?.heating ?? null,
      location_city: scraped?.location_city ?? null,
      location_district: scraped?.location_district ?? null,
      location_neighborhood: scraped?.location_neighborhood || parsed.location || null,
      description: scraped?.description ?? null,
    })
    .select("id")
    .single();

  if (error || !newProp) {
    console.error("[portfolio:insert]", error);
    await sendButtons(ctx.phone, "❌ Mülk eklenirken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Save scraped photos (up to 10) into emlak_property_photos
  let scrapedPhotoCount = 0;
  if (scraped?.photos && scraped.photos.length > 0) {
    const photoRows = scraped.photos.slice(0, 10).map((url, idx) => ({
      property_id: newProp.id,
      user_id: ctx.userId,
      url,
      sort_order: idx + 1,
    }));
    const { error: photoErr } = await supabase.from("emlak_property_photos").insert(photoRows);
    if (photoErr) {
      console.error("[portfolio:photos]", photoErr);
    } else {
      scrapedPhotoCount = photoRows.length;
    }
  }

  // Build info summary
  let info = `✅ ${displayPortal} ilanı eklendi!\n\n`;
  info += `📌 ${title}\n`;
  if (parsed.listing_type) info += `🏷 ${parsed.listing_type === "satilik" ? "Satılık" : "Kiralık"}\n`;
  if (parsed.type) info += `🏠 ${parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1)}\n`;
  if (scraped?.price) info += `💰 ${new Intl.NumberFormat("tr-TR").format(scraped.price)} TL\n`;
  if (scraped?.area) info += `📐 ${scraped.area} m² brüt\n`;
  if (scraped?.net_area) info += `📐 ${scraped.net_area} m² net\n`;
  if (scraped?.rooms || parsed.rooms) info += `🛏 ${scraped?.rooms || parsed.rooms}\n`;
  if (scraped?.location_neighborhood || parsed.location) info += `📍 ${scraped?.location_neighborhood || parsed.location}\n`;
  info += `\n🔗 ${url.substring(0, 60)}...`;

  if (scrapedPhotoCount > 0) info += `📷 ${scrapedPhotoCount} fotoğraf çekildi\n`;

  const hasCore = scraped?.price && scraped?.area;
  if (!hasCore) {
    info += `\n⚠️ Bazı bilgiler eksik — tamamladıktan sonra sunum hazırlayabilirim.`;
  } else {
    info += `\n✨ Kısa süre içinde bu mülk için bir sunum hazır olacak. İstediğiniz zaman inceleyip tek linkle müşterinize gönderebilirsiniz.`;
  }

  await sendButtons(ctx.phone, info, hasCore
    ? [{ id: `cmd:sunum`, title: "📊 Sunumu Hazırla" }]
    : [{ id: `tamamla:${newProp.id}`, title: "✏️ Tamamla" }],
  );

  // Gamification: mission trigger (non-silent — major milestone popup)
  try {
  } catch { /* don't break main flow */ }
}

// ── /ekle — Quick add (URL or guidance) ──────────────────────────────

export async function handleEkle(ctx: WaContext): Promise<void> {
  const args = ctx.text.split(" ").slice(1).join(" ").trim();

  if (args && (args.startsWith("http") || args.includes("sahibinden") || args.includes("shbd.io") || args.includes("hepsiemlak") || args.includes("emlakjet"))) {
    await processPortalUrl(ctx, args);
    return;
  }

  await sendButtons(ctx.phone,
    "🏠 Hızlı Mülk Ekleme\n\nPortal linki yapıştırın veya detaylı ekleme başlatın.",
    [
      { id: "mulkekle_method:link", title: "🔗 Link yapıştır" },
      { id: "mulkekle_method:detayli", title: "📝 Detaylı ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}
