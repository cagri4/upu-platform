/**
 * Cron: İlan Takip Bildirimleri
 *
 * Scrape sonrası çağrılır — kullanıcıların takip kriterlerine uyan
 * yeni ilanları WhatsApp'tan bildirir.
 *
 * Çağırma: daily-scrape.sh part2 sonunda curl ile tetiklenir.
 */
import { NextResponse } from "next/server";
import { sendTrackingNotifications } from "@/tenants/emlak/commands/takip-et";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sent = await sendTrackingNotifications();
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[cron:tracking-notify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
