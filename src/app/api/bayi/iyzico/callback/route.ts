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
import { resolveTenantOrigin } from "@/platform/tenant-origin";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest, token: string, conversationId: string | null) {
  const sb = getServiceClient();
  // Token henüz çözülmeden (tenant bilinmiyor) host-header origin'i kullan.
  let origin = await resolveTenantOrigin(sb, null, req);

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
  // Tenant artık biliniyor — canonical_url tanımlıysa onu tercih et
  origin = await resolveTenantOrigin(sb, tenantId, req);
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

      // Faz 4: bayiye "ödemen alındı, teşekkürler" bildirimi
      try {
        const { emitPaymentReceivedEvent } = await import("@/platform/bayi/events/dispatcher");
        const { data: orderRow } = await sb
          .from("bayi_orders")
          .select("dealer_id, total_amount")
          .eq("tenant_id", tenantId)
          .eq("id", orderId)
          .maybeSingle();
        await emitPaymentReceivedEvent(sb, {
          tenantId,
          orderId,
          dealerId: (orderRow?.dealer_id as string) || null,
          amount: Number(orderRow?.total_amount ?? payment.amount ?? 0),
        });
      } catch (err) {
        console.error("[iyzico:callback:event]", err);
      }
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
