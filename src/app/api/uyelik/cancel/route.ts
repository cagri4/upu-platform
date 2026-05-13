/**
 * /api/uyelik/cancel — Pro aboneliği iptal et.
 *
 * cancel_at_period_end pattern: kullanıcı şu anki periyot sonuna kadar Pro
 * kalır, periyot bitiminde Free'ye düşer (Mollie webhook subscription
 * canceled event'i ile durum güncellenir). Hemen Free'ye düşmez.
 *
 * Hassas action — Faz 6.6 step-up WA OTP zorunlu (`requireWaStepUp`).
 * Cookie 10 dk içinde verify edilmemişse 403 step_up_required.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { cancelSubscription as mollieCancel } from "@/platform/billing/mollie";
import { requireWaStepUp } from "@/platform/auth/step-up";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Step-up gate — Faz 6.6
    const stepUp = await requireWaStepUp(req, auth.userId);
    if (!stepUp.ok) {
      return NextResponse.json({ error: stepUp.error }, { status: 403 });
    }

    const sb = getServiceClient();
    const userId = auth.userId;

    const { data: sub } = await sb
      .from("subscriptions")
      .select("provider_customer_id, provider_subscription_id, plan, status")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub || !sub.provider_subscription_id || !sub.provider_customer_id) {
      return NextResponse.json({ error: "Aktif abonelik bulunamadı." }, { status: 400 });
    }
    if (sub.plan !== "pro_monthly" && sub.plan !== "pro_yearly") {
      return NextResponse.json({ error: "İptal edilebilir Pro abonelik yok." }, { status: 400 });
    }

    try {
      await mollieCancel(sub.provider_customer_id as string, sub.provider_subscription_id as string);
    } catch (err) {
      console.error("[uyelik:cancel] mollie", err);
      // Mollie iptal edilemezse yine de DB'de cancel_at_period_end işaretle —
      // webhook geldiğinde tutarlanır. Kullanıcı sürpriz yaşamasın.
    }

    await sb
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[uyelik:cancel]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
