/**
 * POST /api/bayi-invoices/create — admin/muhasebe yeni fatura kayıt.
 * Body: { dealer_user_id, invoice_no, issue_date, due_date, amount, pdf_url?, notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { notifyDealerNewInvoice } from "@/platform/bayi-finansal/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Fatura oluşturma yetkiniz yok." }, { status: 403 });
  }

  let body: {
    dealer_user_id?: string;
    invoice_no?: string;
    issue_date?: string;
    due_date?: string;
    amount?: number;
    pdf_url?: string;
    notes?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const dealerId = body.dealer_user_id?.trim();
  const invoiceNo = body.invoice_no?.trim();
  const issueDate = body.issue_date;
  const dueDate = body.due_date;
  const amount = Number(body.amount);

  if (!dealerId) return NextResponse.json({ error: "Bayi seçin." }, { status: 400 });
  if (!invoiceNo) return NextResponse.json({ error: "Fatura no girin." }, { status: 400 });
  if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return NextResponse.json({ error: "Düzenleme tarihi geçersiz." }, { status: 400 });
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "Vade tarihi geçersiz." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Tutar pozitif olmalı." }, { status: 400 });
  }

  // Dealer aynı tenant'ta mı?
  const { data: dealer } = await sb
    .from("profiles")
    .select("id")
    .eq("id", dealerId)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!dealer) return NextResponse.json({ error: "Bayi bu tenant'a kayıtlı değil." }, { status: 400 });

  const { data: invoice, error: insertErr } = await sb
    .from("bayi_invoices")
    .insert({
      tenant_id: lookup.tenantId,
      dealer_user_id: dealerId,
      invoice_no: invoiceNo,
      issue_date: issueDate,
      due_date: dueDate,
      amount,
      pdf_url: body.pdf_url?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();

  if (insertErr || !invoice) {
    if (insertErr?.code === "23505") {
      return NextResponse.json({ error: "Bu fatura no zaten kayıtlı." }, { status: 409 });
    }
    console.error("[bayi-invoices/create]", insertErr);
    return NextResponse.json({ error: "Fatura kaydedilemedi." }, { status: 500 });
  }

  void notifyDealerNewInvoice(sb, dealerId, invoiceNo, amount, dueDate);

  return NextResponse.json({ ok: true, invoice_id: invoice.id });
}
