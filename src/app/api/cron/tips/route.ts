/**
 * Tips cron — runs 3x per day, picks an eligible tip per active emlak user,
 * delivers via WhatsApp with CTA button.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { pickTipForUser, logTipShown, isQuietHour, getPrefs } from "@/platform/tips/picker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel cron signs requests — lightweight check
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();

  // Find emlak tenant id
  const { data: tenant } = await sb.from("tenants").select("id").eq("saas_type", "emlak").maybeSingle();
  if (!tenant) return NextResponse.json({ sent: 0, reason: "no_emlak_tenant" });

  // Active users = profiles in emlak tenant with onboarding completed
  const { data: users } = await sb
    .from("profiles")
    .select("id, whatsapp_phone, role, metadata")
    .eq("tenant_id", tenant.id)
    .neq("role", "system");

  const candidates = (users || []).filter((u) => {
    const meta = u.metadata as { onboarding_completed?: boolean } | null;
    return u.whatsapp_phone && meta?.onboarding_completed === true;
  });

  const nowHourUtc = new Date().getUTCHours();
  let sent = 0;
  let skipped = 0;

  for (const u of candidates) {
    try {
      const prefs = await getPrefs(u.id);
      if (!prefs.tips_enabled) { skipped++; continue; }
      if (isQuietHour(prefs, nowHourUtc)) { skipped++; continue; }

      const tip = await pickTipForUser(u.id);
      if (!tip) { skipped++; continue; }

      await sendButtons(u.whatsapp_phone, tip.text, [tip.cta]);
      await logTipShown(u.id, tip.key);
      sent++;
    } catch (err) {
      console.error(`[cron:tips] user ${u.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, candidates: candidates.length });
}
