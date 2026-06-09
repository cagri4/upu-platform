/**
 * GET /api/bayi/faturalar — bayi alıcısının faturaları.
 * bayi_invoices tablosundan dealer_user_id=userId.
 *
 * Faz 3'te Foriba'dan otomatik fatura akışı bu satırları doldurur. Şimdi
 * mevcut kayıtlar listelenir; pdf_url varsa direkt link, yoksa "henüz
 * hazır değil" durumu.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 20;

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`, 10)),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("bayi_invoices")
    .select(
      "id, invoice_no, issue_date, due_date, amount, currency, pdf_url, status, external_ref, notes, created_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .eq("dealer_user_id", userId);

  if (status) query = query.eq("status", status);

  query = query.order("issue_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[bayi:faturalar:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((inv) => ({
    id: inv.id as string,
    invoiceNo: (inv.invoice_no as string) || "",
    issueDate: inv.issue_date as string,
    dueDate: inv.due_date as string,
    amount: Number(inv.amount ?? 0),
    currency: (inv.currency as string) || "TRY",
    pdfUrl: (inv.pdf_url as string) || null,
    status: (inv.status as string) || "open",
    externalRef: (inv.external_ref as string) || null,
    notes: (inv.notes as string) || null,
    createdAt: inv.created_at as string,
  }));

  return NextResponse.json({
    success: true,
    items,
    total: count ?? items.length,
    page,
    pageSize,
  });
}
