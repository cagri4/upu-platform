/**
 * /api/calendar/send-reminder — pg_cron tetiklemesiyle pending events'i işler.
 *
 * Auth: Bearer CRON_SECRET (pg_cron net.http_post header'ı ile gönderir).
 *
 * Davranış:
 *   1. status='pending' AND scheduled_at <= now() events fetch
 *   2. Her birine WA mesajı gönder (sendUrlButton ile Panele Git CTA)
 *   3. status='sent', sent_at=now() update
 *   4. WA hatasında status='failed', error_message log
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  message_template: string | null;
  related_customer_id: string | null;
  related_property_id: string | null;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const now = new Date().toISOString();

  // Pending + due events
  const { data: events } = await sb
    .from("emlak_calendar_events")
    .select("id, user_id, title, description, scheduled_at, message_template, related_customer_id, related_property_id")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (!events || events.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const ev of events as CalendarEvent[]) {
    try {
      // User phone + opsiyonel related customer + property fetch
      const [profileRes, custRes, propRes] = await Promise.all([
        sb.from("profiles").select("whatsapp_phone").eq("id", ev.user_id).single(),
        ev.related_customer_id
          ? sb.from("emlak_customers").select("name, phone").eq("id", ev.related_customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        ev.related_property_id
          ? sb.from("emlak_properties").select("title").eq("id", ev.related_property_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const phone = profileRes.data?.whatsapp_phone as string | undefined;
      if (!phone) {
        await sb.from("emlak_calendar_events")
          .update({ status: "failed", error_message: "Kullanıcı whatsapp_phone yok", updated_at: now })
          .eq("id", ev.id);
        failed++;
        continue;
      }

      // Mesaj inşa
      const cust = custRes.data as { name: string; phone: string | null } | null;
      const prop = propRes.data as { title: string | null } | null;
      const scheduled = new Date(ev.scheduled_at).toLocaleString("tr-TR", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

      const lines: string[] = [];
      lines.push(`🔔 *Hatırlatıcı*\n`);
      lines.push(`*${ev.title}*`);
      if (ev.description) { lines.push(""); lines.push(ev.description); }
      if (cust) {
        lines.push("");
        lines.push(`👤 ${cust.name}${cust.phone ? ` · ${cust.phone}` : ""}`);
      }
      if (prop) {
        lines.push("");
        lines.push(`🏠 ${prop.title || "Mülk"}`);
      }
      lines.push("");
      lines.push(`⏰ ${scheduled}`);
      const text = lines.join("\n");

      await sendText(phone, text);

      // Panele Git CTA — external-redirect (Seçenek A: Android intent://Chrome,
      // iOS Safari breakout, fallback evergreen). WebView dışına çıkarmak için.
      const panelUrl = `${APP_URL}/api/panel/external-redirect?uid=${encodeURIComponent(ev.user_id)}`;
      await sendUrlButton(phone, "Panele dönmek için:", "🖥 Panele Git", panelUrl, { skipNav: true });

      await sb.from("emlak_calendar_events")
        .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", ev.id);
      sent++;
    } catch (err) {
      console.error("[calendar:send-reminder] event failed:", ev.id, err);
      await sb.from("emlak_calendar_events")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message.slice(0, 500) : "unknown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ev.id);
      failed++;
    }
  }

  return NextResponse.json({ success: true, processed: events.length, sent, failed });
}
