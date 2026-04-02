/**
 * Admin Alerts Cron — sends proactive alerts to platform admins
 *
 * Runs at 6:30 AM (before tenant briefings) and hourly for critical alerts.
 * Sends: daily summary, new signup alerts, error spike alerts, inactive user warnings.
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendAdminAlert } from "@/platform/admin/commands";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const hour = now.getUTCHours();
  const alerts: string[] = [];

  try {
    // ── Daily morning summary (runs at ~6:30 AM UTC+3 = 3:30 UTC) ──
    const isDailySummary = hour >= 3 && hour <= 4;

    if (isDailySummary) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // Yesterday's stats
      const { data: yesterdayEvents } = await supabase
        .from("platform_events")
        .select("user_id, event_type")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString());

      const uniqueUsers = new Set((yesterdayEvents || []).map(e => e.user_id).filter(Boolean));
      const commands = (yesterdayEvents || []).filter(e => e.event_type === "command").length;
      const errors = (yesterdayEvents || []).filter(e => e.event_type === "error").length;

      // New signups yesterday
      const { count: newSignups } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString());

      // Inactive users (3+ days)
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: allUsers } = await supabase
        .from("profiles")
        .select("id, display_name, whatsapp_phone")
        .not("whatsapp_phone", "is", null);

      const { data: recentActive } = await supabase
        .from("platform_events")
        .select("user_id")
        .gte("created_at", threeDaysAgo.toISOString());

      const activeUserIds = new Set((recentActive || []).map(e => e.user_id));
      const inactiveUsers = (allUsers || []).filter(u => !activeUserIds.has(u.id));

      let summary = `📊 *Günlük Platform Raporu*\n`;
      summary += `📅 ${yesterday.toLocaleDateString("tr-TR")}\n\n`;
      summary += `👥 Aktif kullanıcı: *${uniqueUsers.size}*\n`;
      summary += `⚡ Komut: *${commands}*\n`;
      summary += `⚠️ Hata: *${errors}*\n`;
      summary += `🆕 Yeni kayıt: *${newSignups || 0}*\n`;

      if (inactiveUsers.length > 0) {
        summary += `\n⚠️ *İnaktif Kullanıcılar (3+ gün):*\n`;
        for (const u of inactiveUsers.slice(0, 5)) {
          summary += `  • ${u.display_name || "İsimsiz"} (${u.whatsapp_phone})\n`;
        }
        if (inactiveUsers.length > 5) {
          summary += `  ... ve ${inactiveUsers.length - 5} kişi daha\n`;
        }
      }

      alerts.push(summary);
    }

    // ── Hourly: New signups since last hour ──
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: newUsers } = await supabase
      .from("profiles")
      .select("display_name, whatsapp_phone, tenant_id")
      .gte("created_at", oneHourAgo.toISOString());

    if (newUsers?.length) {
      for (const u of newUsers) {
        let tenantName = "";
        if (u.tenant_id) {
          const { data: t } = await supabase.from("tenants").select("name").eq("id", u.tenant_id).single();
          tenantName = t?.name || "";
        }
        alerts.push(
          `🆕 *Yeni Kullanıcı!*\n\n` +
          `Ad: ${u.display_name || "İsimsiz"}\n` +
          `Telefon: ${u.whatsapp_phone || "-"}\n` +
          `Tenant: ${tenantName || "-"}`
        );
      }
    }

    // ── Hourly: Error spike check ──
    const { count: hourlyErrors } = await supabase
      .from("platform_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "error")
      .gte("created_at", oneHourAgo.toISOString());

    if ((hourlyErrors || 0) >= 5) {
      const { data: recentErrors } = await supabase
        .from("platform_events")
        .select("error_message, phone, tenant_key")
        .eq("event_type", "error")
        .gte("created_at", oneHourAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(3);

      let errText = `🚨 *Hata Artışı!*\n\nSon 1 saatte *${hourlyErrors}* hata.\n\n`;
      for (const e of recentErrors || []) {
        errText += `• ${(e.error_message || "?").substring(0, 100)} (${e.tenant_key || "?"})\n`;
      }
      alerts.push(errText);
    }

    // Send all alerts
    for (const alert of alerts) {
      await sendAdminAlert(alert);
    }

    return NextResponse.json({ ok: true, alertsSent: alerts.length });
  } catch (err) {
    console.error("[cron:admin-alerts] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
