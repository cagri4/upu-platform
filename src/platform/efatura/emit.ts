/**
 * emitInvoiceForOrder — sipariş onaylandığında otomatik fatura kesme hook'u.
 *
 * Caller: transitionOrderStatus pending → approved (Sprint H wiring).
 * Tetik:
 *   1. Tenant'ın aktif e-Fatura provider'ı (foriba > mikrohizmet > ...)
 *   2. Sipariş + kalemler + bayi snapshot al
 *   3. Provider.issueInvoice çağır
 *   4. Başarılıysa bayi_invoices INSERT + bayi_orders.invoice_id update
 *   5. recordSyncResult (ok/error)
 *
 * Idempotent: aynı sipariş için ikinci çağrıda invoice_id varsa erken
 * döner — çift fatura kesmez.
 *
 * Faz 4 hook: emitInvoiceCreatedEvent({orderId, invoiceId}) — bayiye
 * WA bildirim "Faturanız hazır".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceProvider, InvoiceLine } from "./types";
import { foribaProvider } from "./foriba";

const PROVIDERS: InvoiceProvider[] = [foribaProvider /* mikrohizmet sonra */];

function pickProvider(activeProviders: string[]): InvoiceProvider | null {
  // Sıra: foriba > mikrohizmet (gelecekte). İlk eşleşeni döner.
  for (const provider of PROVIDERS) {
    if (activeProviders.includes(provider.id)) return provider;
  }
  return null;
}

export interface EmitResult {
  ok: boolean;
  invoiceId?: string;
  invoiceNo?: string;
  mocked?: boolean;
  skipped?: "already_invoiced" | "no_provider" | "no_dealer" | "no_items";
  errorMessage?: string;
}

export async function emitInvoiceForOrder(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string;
  },
): Promise<EmitResult> {
  const { tenantId, orderId } = args;

  // 1) Sipariş + idempotency check
  const { data: order } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, subtotal, discount_amount, total_amount, invoice_id, notes",
    )
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return { ok: false, errorMessage: "Sipariş bulunamadı." };
  }
  if (order.invoice_id) {
    return { ok: true, skipped: "already_invoiced", invoiceId: order.invoice_id as string };
  }

  // 2) Aktif fatura provider'larını çek
  const { data: activeSettings } = await sb
    .from("tenant_integration_settings")
    .select("provider")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  const activeProviderIds = (activeSettings ?? []).map((s) => s.provider as string);

  // Faz 3 MVP: provider aktive edilmemiş olsa bile MOCK foriba ile devam
  // et — UI test edilebilir, kapatma istenirse explicit flag eklenir.
  const providers: string[] =
    activeProviderIds.length > 0
      ? activeProviderIds
      : ["foriba"];

  const provider = pickProvider(providers);
  if (!provider) {
    return { ok: false, skipped: "no_provider" };
  }

  // 3) Bayi + kalemleri al
  let buyer = {
    name: "Bayi",
    taxNo: null as string | null,
    taxOffice: null as string | null,
    address: "—",
    city: "Istanbul",
    email: null as string | null,
    phone: null as string | null,
  };
  let dealerUserId: string | null = null;
  let dueDateDays = 30;

  if (order.dealer_id) {
    const { data: dealer } = await sb
      .from("bayi_dealers")
      .select(
        "name, company_name, tax_no, tax_number, tax_office, address, address_line, city, email, phone, payment_term_days, user_id",
      )
      .eq("tenant_id", tenantId)
      .eq("id", order.dealer_id)
      .maybeSingle();
    if (dealer) {
      buyer = {
        name: (dealer.company_name as string) || (dealer.name as string) || "Bayi",
        taxNo: (dealer.tax_no as string) || (dealer.tax_number as string) || null,
        taxOffice: (dealer.tax_office as string) || null,
        address: (dealer.address as string) || (dealer.address_line as string) || "—",
        city: (dealer.city as string) || "Istanbul",
        email: (dealer.email as string) || null,
        phone: (dealer.phone as string) || null,
      };
      dealerUserId = (dealer.user_id as string) || null;
      if (dealer.payment_term_days) dueDateDays = Number(dealer.payment_term_days);
    }
  }

  const { data: items } = await sb
    .from("bayi_order_items")
    .select(
      "product_code, product_name, quantity, unit_price, line_discount, total_price",
    )
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);

  if (!items || items.length === 0) {
    return { ok: false, skipped: "no_items" };
  }

  const lines: InvoiceLine[] = items.map((it) => ({
    productCode: (it.product_code as string) || "",
    productName: (it.product_name as string) || "",
    quantity: Number(it.quantity ?? 0),
    unitPrice: Number(it.unit_price ?? 0),
    vatRate: 18, // Faz 3 MVP: %18 varsayım, kategoriden çekme Faz 3+'ta
    lineTotal: Number(it.total_price ?? 0),
    lineDiscount: Number(it.line_discount ?? 0),
  }));

  const subtotal = Number(order.subtotal ?? 0);
  const discountTotal = Number(order.discount_amount ?? 0);
  const total = Number(order.total_amount ?? 0);
  // Basit KDV gross-down: total içinde 18% gömülü kabul. Gerçek vergi
  // mantığı Foriba canlı entegrasyonuyla detaylanır.
  const taxTotal = +(total - total / 1.18).toFixed(2);

  const today = new Date().toISOString().slice(0, 10);
  const issueResult = await provider.issueInvoice(sb, {
    tenantId,
    orderId,
    orderNumber: (order.order_number as string) || orderId,
    buyer,
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    currency: "TRY",
    issueDate: today,
    notes: (order.notes as string) || undefined,
  });

  if (!issueResult.success || !issueResult.invoiceNo) {
    return {
      ok: false,
      errorMessage: issueResult.errorMessage || "Fatura kesilemedi.",
    };
  }

  // 4) bayi_invoices INSERT
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDateDays);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  const { data: invoice, error: invErr } = await sb
    .from("bayi_invoices")
    .insert({
      tenant_id: tenantId,
      dealer_user_id: dealerUserId,
      invoice_no: issueResult.invoiceNo,
      issue_date: today,
      due_date: dueDateStr,
      amount: total,
      currency: "TRY",
      pdf_url: issueResult.pdfUrl,
      status: "open",
      external_ref: issueResult.externalRef,
      notes: issueResult.mocked
        ? `${issueResult.provider} mock fatura — Foriba canlı sözleşmesiyle değişecek.`
        : `${issueResult.provider} fatura`,
    })
    .select("id")
    .single();

  if (invErr || !invoice) {
    console.error("[efatura:emit:invoice-insert]", invErr);
    return { ok: false, errorMessage: "Fatura kaydı oluşturulamadı." };
  }

  // 5) Order'a invoice_id bağla
  await sb
    .from("bayi_orders")
    .update({ invoice_id: invoice.id })
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  // TODO Faz 4: emitInvoiceCreatedEvent({orderId, invoiceId, dealerUserId})

  return {
    ok: true,
    invoiceId: invoice.id as string,
    invoiceNo: issueResult.invoiceNo,
    mocked: issueResult.mocked,
  };
}
