/**
 * GET /api/bayi-cari/statement?dealer_id=&from=&to=
 *
 * Bayi: kendi cari ekstresi (dealer_id ignore edilir).
 * Admin/muhasebe: dealer_id zorunlu (hangi bayi).
 *
 * Response: rows (entry_type, date, debit, credit, description) +
 * opening_balance + closing_balance + debit_total + credit_total.
 *
 * View `bayi_account_statement` üzerinden okuyor (orders + invoices +
 * payments UNION).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  const sp = req.nextUrl.searchParams;
  const dealerIdQuery = sp.get("dealer_id");
  const fromDate = sp.get("from");
  const toDate = sp.get("to");

  let dealerId: string;
  if (["admin", "muhasebe"].includes(lookup.profile.role || "")) {
    if (!dealerIdQuery) return NextResponse.json({ error: "dealer_id gerekli." }, { status: 400 });
    dealerId = dealerIdQuery;
  } else {
    dealerId = lookup.profile.id;
  }

  // Opening balance: from öncesi tüm hareketler
  let openingDebit = 0;
  let openingCredit = 0;
  if (fromDate) {
    const { data: opening } = await sb
      .from("bayi_account_statement")
      .select("debit, credit")
      .eq("tenant_id", lookup.tenantId)
      .eq("dealer_user_id", dealerId)
      .lt("entry_date", fromDate);
    for (const r of opening || []) {
      openingDebit += Number(r.debit) || 0;
      openingCredit += Number(r.credit) || 0;
    }
  }

  // Range query
  let query = sb
    .from("bayi_account_statement")
    .select("entry_type, reference_id, entry_date, debit, credit, description")
    .eq("tenant_id", lookup.tenantId)
    .eq("dealer_user_id", dealerId)
    .order("entry_date", { ascending: true })
    .limit(1000);

  if (fromDate) query = query.gte("entry_date", fromDate);
  if (toDate) query = query.lte("entry_date", `${toDate}T23:59:59`);

  const { data, error } = await query;
  if (error) {
    console.error("[bayi-cari/statement]", error);
    return NextResponse.json({ error: "Ekstre alınamadı." }, { status: 500 });
  }

  const openingBalance = openingDebit - openingCredit;
  let runningBalance = openingBalance;
  let debitTotal = 0;
  let creditTotal = 0;
  const rows = (data || []).map((r) => {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    runningBalance += debit - credit;
    debitTotal += debit;
    creditTotal += credit;
    return {
      entry_type: r.entry_type as string,
      reference_id: r.reference_id as string,
      entry_date: r.entry_date as string,
      description: r.description as string,
      debit,
      credit,
      balance: runningBalance,
    };
  });

  return NextResponse.json({
    ok: true,
    dealer_id: dealerId,
    rows,
    opening_balance: openingBalance,
    closing_balance: runningBalance,
    debit_total: debitTotal,
    credit_total: creditTotal,
  });
}
