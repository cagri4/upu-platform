/**
 * GET /api/bayi-panel/dashboard?t=<token>
 *
 * Bayi dashboard 6 KPI:
 *   - dealer_count           toplam aktif bayi
 *   - active_orders          aktif sipariş (pending/preparing/shipped status)
 *   - pending_invoices       ödenmemiş fatura sayısı
 *   - overdue_amount         vadesi geçmiş tutar (bayi_dealer_transactions sale + due_date<NOW)
 *   - month_revenue          bu ay sipariş cirosu (orders.total_amount, created_at >= ay başı)
 *   - critical_stock         kritik stok kalem sayısı (stock <= low_stock_threshold)
 *
 * Pattern: emlak /api/panel/dashboard — Promise.all paralel sorgular,
 * tenant_id'ye scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const sb = getServiceClient();
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("id", pt.user_id)
      .single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Tenant bulunamadı." }, { status: 500 });

    // Aktif sipariş için status_id eşleşmesi
    const { data: statuses } = await sb
      .from("bayi_order_statuses")
      .select("id, code");
    const activeStatusIds = (statuses || [])
      .filter(s => ["pending", "preparing", "shipped", "in_transit", "delivering"].includes(s.code))
      .map(s => s.id);

    // Sale type ID (vadesi geçmiş tutar için)
    const { data: txTypes } = await sb
      .from("bayi_transaction_types")
      .select("id, code");
    const saleTypeId = (txTypes || []).find(t => t.code === "sale")?.id;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();
    const todayIso = new Date().toISOString();

    const [
      dealerCountRes,
      activeOrdersRes,
      pendingInvoicesRes,
      overdueTxRes,
      monthOrdersRes,
      stockRes,
      activeInvitesRes,
    ] = await Promise.all([
      sb.from("bayi_dealers").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true),
      activeStatusIds.length
        ? sb.from("bayi_orders").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).in("status_id", activeStatusIds)
        : Promise.resolve({ count: 0 } as { count: number }),
      sb.from("bayi_dealer_invoices").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_paid", false),
      saleTypeId
        ? sb.from("bayi_dealer_transactions").select("amount, due_date")
            .eq("tenant_id", tenantId).eq("transaction_type_id", saleTypeId)
            .lt("due_date", todayIso)
        : Promise.resolve({ data: [] } as { data: Array<{ amount: number; due_date: string }> }),
      sb.from("bayi_orders").select("total_amount")
        .eq("tenant_id", tenantId).gte("created_at", monthStartIso),
      sb.from("bayi_products").select("id, stock_quantity, low_stock_threshold")
        .eq("tenant_id", tenantId).eq("is_active", true),
      sb.from("bayi_invite_links").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true),
    ]);

    const overdueAmount = ((overdueTxRes as { data?: Array<{ amount: number }> }).data || [])
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const monthRevenue = (monthOrdersRes.data || [])
      .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const criticalStock = (stockRes.data || [])
      .filter((p: { stock_quantity: number; low_stock_threshold: number | null }) => {
        const t = p.low_stock_threshold;
        return t != null && p.stock_quantity <= t;
      }).length;

    return NextResponse.json({
      success: true,
      kpis: {
        dealer_count: dealerCountRes.count || 0,
        active_orders: (activeOrdersRes as { count?: number }).count || 0,
        pending_invoices: pendingInvoicesRes.count || 0,
        overdue_amount: overdueAmount,
        month_revenue: monthRevenue,
        critical_stock: criticalStock,
        active_invites: activeInvitesRes.count || 0,
      },
    });
  } catch (err) {
    console.error("[bayi-panel:dashboard]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
