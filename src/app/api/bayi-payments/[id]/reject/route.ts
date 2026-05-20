/**
 * POST /api/bayi-payments/[id]/reject — admin/muhasebe ödemeyi reddeder.
 * Body: { reason? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { notifyDealerPaymentDecision } from "@/platform/bayi-finansal/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const { id } = await params;
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!["admin", "muhasebe"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Red yetkiniz yok." }, { status: 403 });
  }

  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { /* opt */ }
  const reason = (body.reason || "").trim().slice(0, 500) || null;

  const { data: payment } = await sb
    .from("bayi_payments")
    .select("id, status, amount, dealer_user_id")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "Ödeme bulunamadı." }, { status: 404 });
  if (payment.status !== "pending") {
    return NextResponse.json({ error: "Sadece bekleyen ödeme reddedilebilir." }, { status: 409 });
  }

  const { error: updErr } = await sb
    .from("bayi_payments")
    .update({
      status: "rejected",
      approved_by_user_id: lookup.profile.id,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });

  void notifyDealerPaymentDecision(sb, payment.dealer_user_id, Number(payment.amount), false, reason);

  return NextResponse.json({ ok: true, status: "rejected" });
}
