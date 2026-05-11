/**
 * /api/cron/billing-tick — günlük abonelik durumu bakım cron'u.
 *
 * 1. Trial bitenleri Free'ye düşür (plan='free', status='expired')
 * 2. Pro abonelik current_period_end < now ise past_due'ya çek
 *    (Mollie webhook recurring payment ile düzeltir; bu sadece backup)
 *
 * vercel.json içinde 03:00 UTC günlük tetiklenir.
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendNotification } from "@/platform/notifications/send-notification";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const now = new Date().toISOString();

  // 1. Trial expiry → Free
  const { data: trialExpired, error: e1 } = await sb
    .from("subscriptions")
    .update({ plan: "free", status: "expired" })
    .eq("plan", "trial")
    .lt("trial_ends_at", now)
    .select("user_id");

  if (e1) console.error("[cron:billing-tick] trial expiry", e1);

  // Yeni Free'ye düşenlere "faturalama" bildirimi
  for (const row of trialExpired || []) {
    try {
      await sendNotification({
        userId: row.user_id as string,
        type: "faturalama",
        title: "🎁 Deneme süreniz sona erdi",
        body: "14 günlük Pro denemeniz tamamlandı. Kesintisiz devam etmek için Üyelik sayfasından bir plan seçebilirsiniz.",
        payload: { click_target: "/tr/uyelik" },
      });
    } catch (err) {
      console.error("[cron:billing-tick] notify trial-end", err);
    }
  }

  // 2. Pro period_end geçmişse past_due — Mollie webhook geç kalmışsa backup
  const { data: stalePro, error: e2 } = await sb
    .from("subscriptions")
    .update({ status: "past_due" })
    .in("plan", ["pro_monthly", "pro_yearly"])
    .eq("status", "active")
    .lt("current_period_end", now)
    .select("user_id");

  if (e2) console.error("[cron:billing-tick] pro past_due", e2);

  // past_due olan kullanıcılara da "faturalama" bildirimi
  for (const row of stalePro || []) {
    try {
      await sendNotification({
        userId: row.user_id as string,
        type: "faturalama",
        title: "⚠️ Ödeme bekleniyor",
        body: "Aboneliğinizin tahsilatı henüz alınamadı. Lütfen ödeme bilgilerinizi kontrol edin.",
        payload: { click_target: "/tr/uyelik" },
      });
    } catch (err) {
      console.error("[cron:billing-tick] notify past-due", err);
    }
  }

  return NextResponse.json({
    ok: true,
    trial_expired: trialExpired?.length || 0,
    pro_past_due: stalePro?.length || 0,
  });
}
