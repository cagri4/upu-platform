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
      const match = url.match(/[-/](\d{7,12})(?:\/|$|\?)/);
      return match ? match[1] : null;
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
    await sendText(ctx.phone, "🔍 Portal linkini yapıştırın:\n\nOrnek: https://sahibinden.com/ilan/...");
    return;
  }

  await processPortalUrl(ctx, args);
}

export async function handleTaraStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendText(ctx.phone, "Geçerli bir portal linki yapıştırın.");
    return;
  }

  if (text.startsWith("http") || text.includes("sahibinden") || text.includes("hepsiemlak") || text.includes("emlakjet")) {
    await endSession(ctx.userId);
    await processPortalUrl(ctx, text);
    return;
  }

  await sendText(ctx.phone, "Geçerli bir portal linki yapıştırın.\n\nOrnek: https://sahibinden.com/ilan/...");
}

async function processPortalUrl(ctx: WaContext, url: string): Promise<void> {
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

  // Insert property
  const { data: newProp, error } = await supabase
    .from("emlak_properties")
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      title: `${displayPortal} İlanı (${sourceId || "?"})`,
      source_url: url,
      source_portal: portal,
      source_id: sourceId || null,
      status: "aktif",
      type: "daire",
      listing_type: "satilik",
    })
    .select("id")
    .single();

  if (error || !newProp) {
    await sendButtons(ctx.phone, "❌ Mülk eklenirken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await sendButtons(ctx.phone,
    `✅ ${displayPortal} ilanı portföyünüze eklendi!\n\n🆔 ${(newProp.id as string).substring(0, 8)}\n🔗 ${url}`,
    [
      { id: "cmd:portfoyum", title: "Portföyüm" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}

// ── /ekle — Quick add (URL or guidance) ──────────────────────────────

export async function handleEkle(ctx: WaContext): Promise<void> {
  const args = ctx.text.split(" ").slice(1).join(" ").trim();

  if (args && (args.startsWith("http") || args.includes("sahibinden") || args.includes("hepsiemlak") || args.includes("emlakjet"))) {
    await processPortalUrl(ctx, args);
    return;
  }

  await sendButtons(ctx.phone,
    "🏠 Mülk Ekleme\n\nPortal linki yapıştırın veya manuel bilgi girin.",
    [
      { id: "cmd:mulkekle", title: "Manuel Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}
