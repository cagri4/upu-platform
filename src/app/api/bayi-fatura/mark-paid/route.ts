/**
 * POST /api/bayi-fatura/mark-paid — mark an invoice paid. Requires
 * FINANCE_PAYMENTS (or wildcard). Does NOT invalidate the magic-link
 * token so the user can mark several invoices from the same session.
 *
 * Body: { token, invoice_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const invoiceId = String(body.invoice_id || "").trim();
    if (!token || !invoiceId) return NextResponse.json({ error: "Token ve fatura ID gerekli." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, capabilities, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const caps = (profile.capabilities as string[] | null) || [];
    if (!(caps.includes("*") || caps.includes(BAYI_CAPABILITIES.FINANCE_PAYMENTS))) {
      return NextResponse.json({ error: "Ödeme işlemi için yetkiniz yok." }, { status: 403 });
    }

    const { data: invoice } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, amount, dealer_id, is_paid")
      .eq("id", invoiceId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ error: "Fatura bulunamadı." }, { status: 404 });
    if (invoice.is_paid) return NextResponse.json({ error: "Fatura zaten ödenmiş." }, { status: 400 });

    // Try with paid_at (newer schema); fall back to just is_paid.
    let { error: updErr } = await supabase
      .from("bayi_dealer_invoices")
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .eq("tenant_id", profile.tenant_id);
    if (updErr && /paid_at/.test(updErr.message || "")) {
      const retry = await supabase
        .from("bayi_dealer_invoices")
        .update({ is_paid: true })
        .eq("id", invoice.id)
        .eq("tenant_id", profile.tenant_id);
      updErr = retry.error;
    }
    if (updErr) {
      console.error("[bayi-fatura:mark-paid] update err", updErr);
      return NextResponse.json({ error: updErr.message || "Güncellenemedi." }, { status: 500 });
    }

    // Event: notify finance-capability peers
    try {
      const { notifyUsersByCapability } = await import("@/platform/cron/notifications");
      await notifyUsersByCapability(
        profile.tenant_id,
        BAYI_CAPABILITIES.FINANCE_INVOICES,
        `✅ Fatura ödendi olarak işaretlendi — ${new Intl.NumberFormat("tr-TR").format(Number(invoice.amount || 0))} ₺`,
        { excludeUserId: profile.id },
      );
    } catch { /* non-fatal */ }

    // Best-effort notify dealer
    if (invoice.dealer_id) {
      try {
        const { data: dealer } = await supabase
          .from("bayi_dealers")
          .select("user_id")
          .eq("id", invoice.dealer_id)
          .maybeSingle();
        if (dealer?.user_id) {
          const { data: dealerProfile } = await supabase
            .from("profiles")
            .select("whatsapp_phone")
            .eq("id", dealer.user_id)
            .maybeSingle();
          if (dealerProfile?.whatsapp_phone) {
            await sendText(dealerProfile.whatsapp_phone,
              `✅ Faturanız ödendi olarak işaretlendi — ${new Intl.NumberFormat("tr-TR").format(Number(invoice.amount || 0))} ₺`);
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bayi-fatura:mark-paid]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
