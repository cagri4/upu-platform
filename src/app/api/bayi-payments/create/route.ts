/**
 * POST /api/bayi-payments/create
 *
 * Bayi tahsilat bildirimi — manuel kayıt akışı. Status=pending,
 * dekont_url opsiyonel (kullanıcı link paste eder; storage upload
 * sonraki sprint). Admin/muhasebe onaylar.
 *
 * Body: { amount, payment_date, dekont_url?, notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { notifyAdminsPendingPayment } from "@/platform/bayi-finansal/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, display_name, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  let body: { amount?: number; payment_date?: string; dekont_url?: string; notes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Geçerli bir tutar girin." }, { status: 400 });
  }
  const paymentDate = body.payment_date;
  if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return NextResponse.json({ error: "Ödeme tarihi YYYY-MM-DD formatında." }, { status: 400 });
  }

  const { data: payment, error: insertErr } = await sb
    .from("bayi_payments")
    .insert({
      tenant_id: lookup.tenantId,
      dealer_user_id: lookup.profile.id,
      amount,
      payment_date: paymentDate,
      dekont_url: body.dekont_url?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !payment) {
    console.error("[bayi-payments/create]", insertErr);
    return NextResponse.json({ error: "Ödeme kaydedilemedi." }, { status: 500 });
  }

  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
  const dealerName = firma?.ticari_unvan || lookup.profile.display_name || "Bayi";
  void notifyAdminsPendingPayment(sb, lookup.tenantId, dealerName, amount);

  return NextResponse.json({ ok: true, payment_id: payment.id });
}
