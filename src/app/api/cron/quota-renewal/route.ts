/**
 * GET /api/cron/quota-renewal — günlük agent quota period reset.
 *
 * period_end <= CURRENT_DATE olan tüm aktif satırları yeni 30-günlük periyoda
 * çevirir. Tek satır per user (PRIMARY KEY user_id+period_start) güncellenir;
 * geçmiş periyot satırları DB'de kalır (analytics + power user history).
 *
 * Aslında "renewal" = aynı satırı yenile DEĞİL, yeni periyot satırı oluştur.
 * Eski satır used_messages değerleri ile dondurulur (history).
 *
 * Cron schedule (Vercel): her gün 00:00 UTC.
 * vercel.json:
 *   { "crons": [{ "path": "/api/cron/quota-renewal", "schedule": "0 0 * * *" }] }
 *
 * Auth: CRON_SECRET header check.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Bugün veya geçmiş tarihte expire olmuş aktif quota satırları
  const { data: expired } = await sb
    .from("agent_quotas")
    .select("user_id, tenant_id, plan_key, period_end")
    .lte("period_end", today);

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, renewed: 0 });
  }

  let renewed = 0;
  const errors: string[] = [];

  for (const row of expired as Array<{
    user_id: string; tenant_id: string; plan_key: string; period_end: string;
  }>) {
    const newStart = addDaysIso(row.period_end, 1);
    const newEnd = addDaysIso(newStart, 30);

    // Yeni satır eklemeden önce var mı kontrol (cron iki kez çalışırsa idempotent)
    const { data: existing } = await sb
      .from("agent_quotas")
      .select("user_id")
      .eq("user_id", row.user_id)
      .eq("period_start", newStart)
      .maybeSingle();

    if (existing) continue; // zaten yenilenmiş

    const { error } = await sb
      .from("agent_quotas")
      .insert({
        user_id: row.user_id,
        tenant_id: row.tenant_id,
        plan_key: row.plan_key,
        period_start: newStart,
        period_end: newEnd,
      });

    if (error) {
      errors.push(`${row.user_id}: ${error.message}`);
    } else {
      renewed++;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: expired.length,
    renewed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
