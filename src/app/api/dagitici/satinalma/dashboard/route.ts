/**
 * GET /api/dagitici/satinalma/dashboard — satın alma özeti.
 *
 * Aktif PO listesi (sent/partial), gecikmiş PO uyarıları, tedarikçi bazlı
 * toplam sipariş tutarı + ortalama gecikme + cari bakiye. Tümü tenant scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);

  const { data: pos } = await sb
    .from("bayi_purchase_orders")
    .select("id, po_number, supplier_id, status, expected_date, total_amount, created_at, bayi_suppliers(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const { data: pays } = await sb
    .from("bayi_supplier_payments")
    .select("supplier_id, amount")
    .eq("tenant_id", tenantId);

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  const paidBySupplier = new Map<string, number>();
  for (const p of pays ?? []) {
    const sid = p.supplier_id as string;
    paidBySupplier.set(sid, (paidBySupplier.get(sid) ?? 0) + Number(p.amount ?? 0));
  }

  interface SupAgg { name: string; debt: number; orders: number; overdueDays: number[]; }
  const supAgg = new Map<string, SupAgg>();
  const activePOs: Array<Record<string, unknown>> = [];
  const overduePOs: Array<Record<string, unknown>> = [];

  for (const p of pos ?? []) {
    const sid = p.supplier_id as string;
    const name = (pick(p.bayi_suppliers)?.name as string) || "Tedarikçi";
    const status = p.status as string;
    const total = Number(p.total_amount ?? 0);
    const exp = (p.expected_date as string) || null;
    const isActive = ["sent", "partial"].includes(status);
    const isOverdue = isActive && !!exp && exp < todayStr;

    if (status !== "draft") {
      const agg = supAgg.get(sid) ?? { name, debt: 0, orders: 0, overdueDays: [] };
      agg.debt += total;
      agg.orders += 1;
      if (isOverdue && exp) agg.overdueDays.push(Math.round((todayMs - Date.parse(exp)) / DAY_MS));
      supAgg.set(sid, agg);
    }

    if (isActive) {
      const card = { id: p.id, poNumber: p.po_number, supplierName: name, status, expectedDate: exp, total, overdue: isOverdue };
      activePOs.push(card);
      if (isOverdue) overduePOs.push({ ...card, daysLate: exp ? Math.round((todayMs - Date.parse(exp)) / DAY_MS) : 0 });
    }
  }

  const suppliers = Array.from(supAgg.entries()).map(([sid, a]) => {
    const paid = paidBySupplier.get(sid) ?? 0;
    const avgDelay = a.overdueDays.length > 0 ? Math.round(a.overdueDays.reduce((s, d) => s + d, 0) / a.overdueDays.length) : 0;
    return {
      id: sid,
      name: a.name,
      orders: a.orders,
      totalOrdered: +a.debt.toFixed(2),
      paid: +paid.toFixed(2),
      balance: +(a.debt - paid).toFixed(2),
      avgDelayDays: avgDelay,
    };
  }).sort((x, y) => y.totalOrdered - x.totalOrdered);

  return NextResponse.json({
    success: true,
    totals: {
      activePOs: activePOs.length,
      overduePOs: overduePOs.length,
      openBalance: +suppliers.reduce((s, x) => s + x.balance, 0).toFixed(2),
    },
    activePOs,
    overduePOs,
    suppliers,
  });
}
