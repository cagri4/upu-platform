/**
 * POST /api/bayi/iyzico/callback — iyzico CF 3DS sonrası callback.
 *
 * iyzico kullanıcıyı bizim callbackUrl'imize POST eder; body içinde
 * `token` ve `conversationId` gelir. Burada retrievePayment çağırıp
 * paymentStatus'a göre DB'yi güncelle, kullanıcıyı /tr/bayi/odeme/sonuc
 * sayfasına redirect et.
 *
 * Bu endpoint AUTH GATE OLMAZ — iyzico server-to-server gönderir.
 * Güvenlik: iyzico tarafı token'ın gerçek olduğunu retrieveAPI ile
 * doğrular; conversationId'ye göre order eşleştirilir.
 *
 * GET de destekler — bazı sandbox testleri query ile geliyor.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { retrievePayment } from "@/platform/payment/iyzico";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

function appOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env;
  const host = req.headers.get("host") || "retailai.upudev.nl";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

async function handle(req: NextRequest, token: string, conversationId: string | null) {
  const origin = appOrigin(req);
  const sb = getServiceClient();

  if (!token) {
    return NextResponse.redirect(
      `${origin}/tr/bayi/odeme/sonuc?status=error&reason=token-yok`,
      303,
    );
  }

  // Token'a göre payment + order bul (tenant cross-check için)
  const { data: payment } = await sb
    .from("bayi_payments")
    .select("id, tenant_id, order_id, dealer_user_id, amount")
    .eq("provider", "iyzico")
    .eq("provider_payment_id", token)
    .maybeSingle();

  if (!payment) {
    return NextResponse.redirect(
      `${origin}/tr/bayi/odeme/sonuc?status=error&reason=odeme-bulunamadi`,
      303,
    );
  }

  const tenantId = payment.tenant_id as string;
  const orderId = (payment.order_id as string) || null;

  const result = await retrievePayment(sb, tenantId, token);
  const isPaid =
    result.status === "success" &&
    (result.paymentStatus === "SUCCESS" || result.paymentStatus === "PAID");

  if (isPaid) {
    await sb
      .from("bayi_payments")
      .update({
        status: "approved",
        paid_at: new Date().toISOString(),
        metadata: { ...(result.raw || {}), conversationId },
      })
      .eq("tenant_id", tenantId)
      .eq("id", payment.id);

    if (orderId) {
      await sb
        .from("bayi_orders")
        .update({ payment_status: "paid" })
        .eq("tenant_id", tenantId)
        .eq("id", orderId);

      // Ödeme alındı → siparişi otomatik onayla (paid + pending birleşimi)
      // Manuel onay tercih edilirse bu transition kaldırılabilir; B2B
      // portal MVP'de "ödeme = onay" varsayımı.
      await transitionOrderStatus(sb, {
        tenantId,
        orderId,
        toStatus: "approved",
        reason: `iyzico ödemesi alındı (${token.slice(0, 12)}…)`,
        profileId: null,
      });
    }

    return NextResponse.redirect(
      `${origin}/tr/bayi/odeme/sonuc?status=success&order_id=${orderId ?? ""}`,
      303,
    );
  }

  // Başarısız
  await sb
    .from("bayi_payments")
    .update({
      status: "rejected",
      rejection_reason: result.errorMessage || result.paymentStatus || "iyzico reddetti",
      metadata: { ...(result.raw || {}) },
    })
    .eq("tenant_id", tenantId)
    .eq("id", payment.id);

  if (orderId) {
    await sb
      .from("bayi_orders")
      .update({ payment_status: "failed" })
      .eq("tenant_id", tenantId)
      .eq("id", orderId);
  }

  return NextResponse.redirect(
    `${origin}/tr/bayi/odeme/sonuc?status=failed&reason=${encodeURIComponent(
      result.errorMessage || "iyzico-reddetti",
    )}`,
    303,
  );
}

export async function POST(req: NextRequest) {
  let token = "";
  let conversationId: string | null = null;
  try {
    const form = await req.formData();
    token = (form.get("token") as string) || "";
    conversationId = (form.get("conversationId") as string) || null;
  } catch {
    // bazı senaryolarda JSON gelebilir
    try {
      const json = (await req.json()) as { token?: string; conversationId?: string };
      token = json.token || "";
      conversationId = json.conversationId || null;
    } catch {
      // boş geç
    }
  }
  return handle(req, token, conversationId);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const conversationId = url.searchParams.get("conversationId");
  return handle(req, token, conversationId);
}
