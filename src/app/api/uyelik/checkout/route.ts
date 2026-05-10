/**
 * /api/uyelik/checkout — Mollie checkout başlat.
 *
 * Body: { plan: 'pro_monthly' | 'pro_yearly' }
 *
 * Akış:
 * 1. Cookie auth → userId
 * 2. profiles'tan email/display_name al
 * 3. Subscriptions'ta provider_customer_id varsa kullan, yoksa Mollie'de
 *    customer oluştur ve kaydet
 * 4. createFirstPayment(...) → Mollie checkout URL döner
 * 5. Client redirect eder, kullanıcı kart bilgisi girer
 * 6. Mollie webhook tetiklenir (success'te recurring subscription create)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { ensureTrialSubscription } from "@/platform/billing/is-pro";
import { createCustomer, createFirstPayment, type Plan } from "@/platform/billing/mollie";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const plan = body?.plan as Plan | undefined;
    if (plan !== "pro_monthly" && plan !== "pro_yearly") {
      return NextResponse.json({ error: "Geçersiz plan." }, { status: 400 });
    }

    const sb = getServiceClient();
    const userId = auth.userId;

    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, email, whatsapp_phone")
      .eq("id", userId)
      .single();
    const email = (profile?.email as string | undefined) || `${userId}@upu.local`;
    const name = (profile?.display_name as string | undefined) || undefined;

    const sub = await ensureTrialSubscription(userId);

    let customerId = sub.provider_customer_id;
    if (!customerId) {
      const customer = await createCustomer({ email, name, userId });
      customerId = customer.id;
      await sb
        .from("subscriptions")
        .update({
          provider_customer_id: customerId,
          payment_provider: "mollie",
        })
        .eq("user_id", userId);
    }

    const payment = await createFirstPayment({ customerId, plan, userId });
    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) {
      console.error("[uyelik:checkout] no checkout URL", payment);
      return NextResponse.json({ error: "Mollie checkout URL alınamadı." }, { status: 500 });
    }

    return NextResponse.json({ success: true, checkoutUrl });
  } catch (err) {
    console.error("[uyelik:checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bir hata oluştu." },
      { status: 500 },
    );
  }
}
