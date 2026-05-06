/**
 * /api/cron/scrape-report — Sahibinden günlük tarama özet raporu.
 *
 * Tetiklenme: daily-scrape.sh part3/full sonunda lokal cron tarafından
 * curl ile çağrılır. ADMIN_PHONE env'ine WhatsApp mesajı atar.
 *
 * Veri kaynağı: emlak_daily_leads (DB) — snapshot_date=bugün.
 * URL bazlı detay + anomaly tespiti. Yoğun-hacim kategoride 0 ilan ise
 * "anomali — manuel kontrol", düşük-hacim'de 0 ilan ise "muhtemelen gerçek 0".
 *
 * Auth: Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CATEGORY_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", rezidans: "Rezidans", mustakil: "Müstakil",
  yazlik: "Yazlık", arsa: "Arsa", buro_ofis: "Büro/Ofis", dukkan: "Dükkan",
  depo: "Depo", komple_bina: "Komple Bina", bina: "Bina",
  devre_mulk: "Devre Mülk", otel: "Otel", apart_otel: "Apart Otel",
};

function fmtCategory(listing: string | null, type: string | null): string {
  const lt = listing === "satilik" ? "Satılık" : listing === "kiralik" ? "Kiralık" : (listing || "—");
  const pt = type ? (CATEGORY_LABELS[type] || type) : "—";
  return `${lt} ${pt}`;
}

/**
 * scrape-v3.mjs BASE_URLS sırasıyla aynı 23 kategori. high_volume=true
 * olanlar Bodrum'da yoğun hacme sahip; bunlar 0 ilan döndürürse
 * "anomali" sayılır. high_volume=false olanlar (otel, devre-mülk vb.)
 * Bodrum'da nadir, 0 ilan "muhtemelen gerçek".
 */
const SCRAPE_CATEGORIES: Array<{ listing: string; type: string; highVolume: boolean }> = [
  { listing: "satilik", type: "daire", highVolume: true },
  { listing: "satilik", type: "rezidans", highVolume: true },
  { listing: "satilik", type: "mustakil", highVolume: true },
  { listing: "satilik", type: "villa", highVolume: true },
  { listing: "satilik", type: "yazlik", highVolume: true },
  { listing: "kiralik", type: "daire", highVolume: true },
  { listing: "kiralik", type: "rezidans", highVolume: true },
  { listing: "kiralik", type: "mustakil", highVolume: true },
  { listing: "kiralik", type: "villa", highVolume: true },
  { listing: "satilik", type: "buro_ofis", highVolume: true },
  { listing: "satilik", type: "depo", highVolume: false },
  { listing: "satilik", type: "dukkan", highVolume: false },
  { listing: "satilik", type: "komple_bina", highVolume: false },
  { listing: "kiralik", type: "buro_ofis", highVolume: true },
  { listing: "kiralik", type: "dukkan", highVolume: false },
  { listing: "satilik", type: "arsa", highVolume: true },
  { listing: "kiralik", type: "arsa", highVolume: false },
  { listing: "satilik", type: "bina", highVolume: false },
  { listing: "satilik", type: "devre_mulk", highVolume: false },
  { listing: "kiralik", type: "devre_mulk", highVolume: false },
  { listing: "satilik", type: "otel", highVolume: false },
  { listing: "kiralik", type: "otel", highVolume: false },
  { listing: "kiralik", type: "apart_otel", highVolume: false },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminPhone = (process.env.ADMIN_PHONE || "").replace(/\D/g, "");
  if (!adminPhone) {
    return NextResponse.json({ error: "ADMIN_PHONE env not set" }, { status: 500 });
  }

  try {
    const sb = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: leads, error } = await sb
      .from("emlak_daily_leads")
      .select("type, listing_type")
      .eq("snapshot_date", today);
    if (error) throw error;

    // Per-category sayım
    const counts = new Map<string, number>(); // key: "satilik:daire"
    for (const l of leads || []) {
      const k = `${l.listing_type || ""}:${l.type || ""}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const total = leads?.length || 0;

    // URL bazlı detay (23 kategori)
    const urlLines: string[] = [];
    const anomalies: string[] = [];
    const realZeros: string[] = [];
    for (const cat of SCRAPE_CATEGORIES) {
      const count = counts.get(`${cat.listing}:${cat.type}`) || 0;
      const label = fmtCategory(cat.listing, cat.type);
      if (count > 0) {
        urlLines.push(`✅ ${label}: ${count}`);
      } else if (cat.highVolume) {
        urlLines.push(`⚠️ ${label}: 0 (anomali)`);
        anomalies.push(`• ${label} — yoğun hacim kategorisi 0 döndü; lazy-load veya anti-bot olabilir.`);
      } else {
        urlLines.push(`◌ ${label}: 0`);
        realZeros.push(label);
      }
    }

    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric",
    });

    let text =
      `🌙 *Sahibinden Günlük Tarama Raporu*\n📅 ${todayStr}\n\n` +
      (total > 0
        ? `✅ Tarama tamamlandı\n📦 Bodrum sahibi-only: *${total}* ilan\n\n`
        : `⚠️ Tarama tamamlandı ama bugün hiç ilan import edilmedi.\n\n`) +
      `📋 *URL bazlı detay (23 kategori):*\n${urlLines.join("\n")}\n\n`;

    if (anomalies.length > 0) {
      text += `🚨 *ANOMALİLER (${anomalies.length}):*\n${anomalies.join("\n")}\n\n`;
    }
    if (realZeros.length > 0) {
      text += `_Boş kategoriler (muhtemelen gerçek 0): ${realZeros.length} adet (otel/devre-mülk/depo/komple-bina vb.)_\n\n`;
    }
    text += `_Detay log: scripts/output/scrape-detail-*.log_`;

    // WA limiti 4096 char — overflow guard
    if (text.length > 3900) text = text.substring(0, 3900) + "\n…(devamı log'da)";

    await sendText(adminPhone, text);
    return NextResponse.json({
      success: true,
      total,
      categories_with_data: counts.size,
      anomalies: anomalies.length,
      sent_to: adminPhone,
    });
  } catch (err) {
    console.error("[scrape-report]", err);
    const errMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
    try {
      await sendText(adminPhone, `❌ *Sahibinden Tarama Raporu — HATA*\n\n${errMsg.substring(0, 500)}`);
    } catch { /* swallow */ }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
