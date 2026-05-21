/**
 * GET /api/cron/bayi-churn — günlük churn risk taraması.
 *
 * `bayi_churn_signals` view'ından risk_level='risk' olan bayileri çek;
 * eşik yeni geçildiyse dağıtıcı admin'ine WA + bildirim push.
 * State tracking: `notifications` tablo type='churn_risk' + dedupe
 * (aynı dealer 7 günde 1 kez).
 *
 * Cron schedule (Vercel): her gün 03:00 UTC.
 * Auth: CRON_SECRET Bearer.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendNotification } from "@/platform/notifications/send-notification";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();

  // Risk altındaki bayiler — view runtime
  const { data: signals, error } = await sb
    .from("bayi_churn_signals")
    .select("dealer_id, tenant_id, dealer_name, company_name, risk_level, days_since_last_order, max_overdue_days, orders_last_30d, orders_prev_30d")
    .eq("risk_level", "risk");
  if (error) {
    console.error("[cron:bayi-churn] view error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!signals || signals.length === 0) {
    return NextResponse.json({ ok: true, risks: 0, notified: 0 });
  }

  // Tenant başına admin'leri bul
  const tenantIds = Array.from(new Set(signals.map((s) => s.tenant_id)));
  const { data: admins } = await sb
    .from("profiles")
    .select("id, tenant_id, role")
    .in("tenant_id", tenantIds)
    .in("role", ["admin", "user"]);

  const adminsByTenant = new Map<string, string[]>();
  for (const a of admins || []) {
    if (!adminsByTenant.has(a.tenant_id)) adminsByTenant.set(a.tenant_id, []);
    adminsByTenant.get(a.tenant_id)!.push(a.id);
  }

  // 7-günlük dedupe: aynı dealer için son 7g içinde churn_risk bildirimi var mı?
  const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  let notified = 0;
  for (const s of signals) {
    const tenantAdmins = adminsByTenant.get(s.tenant_id) || [];
    if (tenantAdmins.length === 0) continue;

    // Dedupe — payload.dealer_id eşleşen var mı
    const { data: recent } = await sb
      .from("notifications")
      .select("id")
      .in("user_id", tenantAdmins)
      .eq("type", "churn_risk")
      .gte("created_at", sevenAgo)
      .contains("payload", { dealer_id: s.dealer_id })
      .limit(1);
    if (recent && recent.length > 0) continue;

    const name = s.dealer_name || s.company_name || "Bayi";
    const body = [
      `🔴 ${name} — risk altında.`,
      s.days_since_last_order >= 60 ? `${s.days_since_last_order} gündür sipariş yok.` : "",
      s.max_overdue_days >= 30 ? `${s.max_overdue_days} gün vade gecikmesi.` : "",
      "Recovery aksiyonu öner.",
    ].filter(Boolean).join(" ");

    for (const adminId of tenantAdmins) {
      const link = `/tr/bayi-risk`;
      const result = await sendNotification({
        userId: adminId,
        type: "churn_risk",
        title: "⚠️ Bayi Risk Altında",
        body,
        payload: { click_target: link, dealer_id: s.dealer_id, risk_level: s.risk_level },
      });
      if (result.notification_id) notified++;
    }
  }

  return NextResponse.json({ ok: true, risks: signals.length, notified });
}
