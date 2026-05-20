/**
 * GET /api/bayi-export/cari — cari ekstre Excel export.
 *
 * Query: dealer_id (admin), from, to (opsiyonel).
 * Bayi kendi ekstresini export eder, admin/muhasebe dealer_id verir.
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

  const sp = req.nextUrl.searchParams;
  const dealerIdQuery = sp.get("dealer_id");
  let dealerId: string;
  if (["admin", "muhasebe"].includes(lookup.profile.role || "")) {
    dealerId = dealerIdQuery || lookup.profile.id;
  } else {
    dealerId = lookup.profile.id;
  }

  let query = sb
    .from("bayi_account_statement")
    .select("entry_type, entry_date, description, debit, credit")
    .eq("tenant_id", lookup.tenantId)
    .eq("dealer_user_id", dealerId)
    .order("entry_date", { ascending: true });

  const from = sp.get("from");
  const to = sp.get("to");
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", `${to}T23:59:59`);

  const { data, error } = await query;
  if (error) return new Response("query failed", { status: 500 });

  let balance = 0;
  const rows = (data || []).map((r) => {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    balance += debit - credit;
    return {
      tarih: new Date(r.entry_date as string).toLocaleDateString("tr-TR"),
      tip: r.entry_type,
      aciklama: r.description,
      borc: debit,
      alacak: credit,
      bakiye: balance,
    };
  });

  const buffer = await buildXlsx({
    sheetName: "Cari Ekstre",
    columns: [
      { header: "Tarih",     key: "tarih",     width: 14 },
      { header: "Tip",       key: "tip",       width: 12 },
      { header: "Açıklama",  key: "aciklama",  width: 40 },
      { header: "Borç",      key: "borc",      width: 14, money: true },
      { header: "Alacak",    key: "alacak",    width: 14, money: true },
      { header: "Bakiye",    key: "bakiye",    width: 14, money: true },
    ],
    rows,
  });

  return xlsxResponse(buffer, `cari-ekstre-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
