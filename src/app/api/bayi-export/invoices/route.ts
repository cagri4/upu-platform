/**
 * GET /api/bayi-export/invoices — fatura listesi Excel export.
 * Admin/muhasebe: tenant scope, bayi: kendi faturaları.
 */
import { NextRequest } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { buildXlsx, xlsxResponse } from "@/platform/bayi-finansal/excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return new Response("forbidden", { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return new Response(auth.error, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return new Response(lookup.error, { status: lookup.status });

  const isAdminScope = ["admin", "muhasebe"].includes(lookup.profile.role || "");

  let query = sb
    .from("bayi_invoices")
    .select("invoice_no, issue_date, due_date, amount, status, dealer_user_id, pdf_url, notes")
    .eq("tenant_id", lookup.tenantId)
    .order("due_date", { ascending: false });

  if (!isAdminScope) query = query.eq("dealer_user_id", lookup.profile.id);

  const { data, error } = await query;
  if (error) return new Response("query failed", { status: 500 });

  let dealerMap: Record<string, string> = {};
  if (isAdminScope && data) {
    const ids = Array.from(new Set(data.map((r) => r.dealer_user_id)));
    const { data: dealers } = await sb.from("profiles").select("id, display_name, metadata").in("id", ids);
    dealerMap = Object.fromEntries((dealers || []).map((d) => {
      const meta = (d.metadata as Record<string, unknown>) || {};
      const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
      return [d.id, firma?.ticari_unvan || d.display_name || "Bayi"];
    }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = (data || []).map((r) => ({
    fatura_no: r.invoice_no,
    bayi: dealerMap[r.dealer_user_id as string] || "—",
    duzenleme: r.issue_date,
    vade: r.due_date,
    tutar: Number(r.amount),
    durum: r.status === "open" && (r.due_date as string) < today ? "overdue" : r.status,
    pdf: r.pdf_url || "",
    not: r.notes || "",
  }));

  const buffer = await buildXlsx({
    sheetName: "Faturalar",
    columns: [
      { header: "Fatura No",    key: "fatura_no",  width: 16 },
      { header: "Bayi",         key: "bayi",       width: 28 },
      { header: "Düzenleme",    key: "duzenleme",  width: 14 },
      { header: "Vade",         key: "vade",       width: 14 },
      { header: "Tutar",        key: "tutar",      width: 14, money: true },
      { header: "Durum",        key: "durum",      width: 12 },
      { header: "PDF",          key: "pdf",        width: 40 },
      { header: "Not",          key: "not",        width: 30 },
    ],
    rows,
  });

  return xlsxResponse(buffer, `faturalar-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
