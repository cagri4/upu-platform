/**
 * Bayi finansal akış bildirimleri (payments + invoices).
 *
 * Best-effort WA bot mesajları — 24h customer service window dışı silent
 * drop OK.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/platform/whatsapp/send";

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export async function notifyAdminsPendingPayment(
  sb: SupabaseClient,
  tenantId: string,
  dealerName: string,
  amount: number,
): Promise<void> {
  try {
    const { data: admins } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "muhasebe"])
      .not("whatsapp_phone", "is", null);
    if (!admins?.length) return;
    const body = `🔔 ${dealerName} yeni ödeme bildirdi: ${fmtTRY(amount)} — onay bekliyor.`;
    await Promise.all(
      admins
        .filter((a) => a.whatsapp_phone)
        .map((a) => sendText(a.whatsapp_phone, body).catch(() => { /* silent */ })),
    );
  } catch (err) {
    console.error("[notifyAdminsPendingPayment]", err);
  }
}

export async function notifyDealerPaymentDecision(
  sb: SupabaseClient,
  dealerUserId: string,
  amount: number,
  approved: boolean,
  reason?: string | null,
): Promise<void> {
  try {
    const { data: dealer } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", dealerUserId)
      .maybeSingle();
    if (!dealer?.whatsapp_phone) return;
    const body = approved
      ? `✅ Ödeme onaylandı, ${fmtTRY(amount)} cari hesaba işlendi.`
      : `❌ Ödeme reddedildi (${fmtTRY(amount)}).${reason ? `\nSebep: ${reason}` : ""}`;
    await sendText(dealer.whatsapp_phone, body).catch(() => {});
  } catch (err) {
    console.error("[notifyDealerPaymentDecision]", err);
  }
}

export async function notifyDealerNewInvoice(
  sb: SupabaseClient,
  dealerUserId: string,
  invoiceNo: string,
  amount: number,
  dueDate: string,
): Promise<void> {
  try {
    const { data: dealer } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", dealerUserId)
      .maybeSingle();
    if (!dealer?.whatsapp_phone) return;
    const dueLabel = new Date(dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    const body = `🧾 Yeni fatura: ${invoiceNo} — ${fmtTRY(amount)}\nVade: ${dueLabel}`;
    await sendText(dealer.whatsapp_phone, body).catch(() => {});
  } catch (err) {
    console.error("[notifyDealerNewInvoice]", err);
  }
}
