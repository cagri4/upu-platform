/**
 * /api/cron/scrape-report — Sahibinden günlük tarama özet raporu.
 *
 * Tetiklenme: daily-scrape.sh part3/full sonunda lokal cron tarafından
 * curl ile çağrılır. ADMIN_PHONE env'ine WhatsApp mesajı atar.
 *
 * Log parsing yerine DB sorgusu kullanılır (snapshot_date=bugün) —
 * daily-scrape.sh ile aynı kaynak ama daha güvenilir.
 *
 * Auth: Bearer CRON_SECRET (zorunlu).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CATEGORY_LABELS: Record<string, string> = {
  daire: "Daire",
  villa: "Villa",
  rezidans: "Rezidans",
  mustakil: "Müstakil",
  yazlik: "Yazlık",
  arsa: "Arsa",
  buro_ofis: "Büro/Ofis",
  dukkan: "Dükkan",
  depo: "Depo",
  komple_bina: "Komple Bina",
  bina: "Bina",
  devre_mulk: "Devre Mülk",
  otel: "Otel",
  apart_otel: "Apart Otel",
};

function fmtCategory(listing: string | null, type: string | null): string {
  const lt = listing === "satilik" ? "Satılık" : listing === "kiralik" ? "Kiralık" : (listing || "—");
  const pt = type ? (CATEGORY_LABELS[type] || type) : "—";
  return `${lt} ${pt}`;
}

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

    const total = leads?.length || 0;
    const dist: Record<string, number> = {};
    for (const l of leads || []) {
      const k = fmtCategory(l.listing_type as string | null, l.type as string | null);
      dist[k] = (dist[k] || 0) + 1;
    }

    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric",
    });

    const distLines = Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k, v]) => `• ${k}: ${v}`)
      .join("\n");

    const text =
      `🌙 *Sahibinden Günlük Tarama Raporu*\n` +
      `📅 ${todayStr}\n\n` +
      (total > 0
        ? `✅ Tarama tamamlandı\n📦 Bodrum sahibi-only: *${total}* ilan (DB'ye eklenen)\n\n`
        : `⚠️ Tarama tamamlandı ama bugün hiç ilan import edilmedi.\n\n`) +
      (distLines
        ? `📊 *Kategori dağılımı:*\n${distLines}\n\n`
        : "") +
      `_Detay log: scripts/output/scrape-detail-*.log_`;

    await sendText(adminPhone, text);
    return NextResponse.json({
      success: true,
      total,
      categories: Object.keys(dist).length,
      sent_to: adminPhone,
    });
  } catch (err) {
    console.error("[scrape-report]", err);
    const errMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
    // Hata durumunda da admin'e bildir
    try {
      await sendText(adminPhone, `❌ *Sahibinden Tarama Raporu — HATA*\n\n${errMsg.substring(0, 500)}`);
    } catch { /* swallow */ }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
