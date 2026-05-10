/**
 * /api/uyelik/init — kullanıcının subscription durumunu döner.
 * Subscription kaydı yoksa otomatik trial başlatır (idempotent).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { ensureTrialSubscription, isProSub } from "@/platform/billing/is-pro";
import { PLAN_AMOUNT } from "@/platform/billing/mollie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sub = await ensureTrialSubscription(auth.userId);
  const tier: "free" | "pro" = isProSub(sub) ? "pro" : "free";

  return NextResponse.json({
    success: true,
    subscription: {
      plan: sub.plan,
      status: sub.status,
      trial_ends_at: sub.trial_ends_at,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      canceled_at: sub.canceled_at,
      provider_customer_id: sub.provider_customer_id,
      provider_subscription_id: sub.provider_subscription_id,
    },
    tier,
    plans: [
      { id: "pro_monthly", label: "Aylık", amount: PLAN_AMOUNT.pro_monthly, currency: "EUR", interval: "ay" },
      { id: "pro_yearly",  label: "Yıllık", amount: PLAN_AMOUNT.pro_yearly,  currency: "EUR", interval: "yıl", badge: "2 ay bedava" },
    ],
  });
}
