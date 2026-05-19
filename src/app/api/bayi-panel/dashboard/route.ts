/**
 * GET /api/bayi-panel/dashboard
 *
 * Bayi panel KPI dashboard — subdomain-aware tenant resolution.
 *
 * Auth chain:
 *   1. x-tenant-key header (middleware'in subdomain → tenant resolution'ı) MUST = "bayi"
 *   2. Cookie session (resolvePanelAuth) → userId (profile.id)
 *   3. profile.auth_user_id → auth.users.id (multi-tenant anchor)
 *   4. Bayi profile lookup: (auth_user_id, tenant_id=bayi) composite
 *   5. KPI queries scoped to bayi tenant_id
 *
 * Multi-tenant fix: Admin user emlak+bayi profile'a sahipse, cookie
 * session emlak profile.id taşıyabilir (eski evergreen URL'leri).
 * Subdomain'den bayi context zorla → auth_user_id ile bayi profile'ı
 * doğru getir → KPI'lar bayi tenant_id ile filtreli.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByDomain, getTenantByKey } from "@/tenants/config";
import { sanitizeBayiQuickActions, DEFAULT_BAYI_QUICK_ACTIONS } from "@/platform/quick-actions/bayi-keys";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1) Subdomain tenant guard — middleware /api/ path'lerini skip ediyor
    //    (PUBLIC_PATHS), x-tenant-key header endpoint'e gelmez. Host'tan
    //    doğrudan resolve et (manifest.json endpoint ile aynı pattern).
    const host = req.headers.get("host") || "";
    const hostTenant = getTenantByDomain(host);
    if (hostTenant?.key !== "bayi") {
      return NextResponse.json({ error: "Bu endpoint yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
    }

    const bayiTenantCfg = getTenantByKey("bayi");
    if (!bayiTenantCfg) {
      return NextResponse.json({ error: "Bayi tenant config bulunamadı." }, { status: 500 });
    }
    const bayiTenantId = bayiTenantCfg.tenantId;

    // 2) Cookie session (token fallback) → userId (profile.id)
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const sb = getServiceClient();

    // 3) profile.id → auth_user_id (multi-tenant anchor)
    const { data: ownProfile } = await sb
      .from("profiles")
      .select("auth_user_id")
      .eq("id", auth.userId)
      .maybeSingle();
    const authUserId = ownProfile?.auth_user_id || auth.userId;

    // 4) Bayi profile composite lookup (auth_user_id + bayi tenant_id)
    const { data: bayiProfile } = await sb
      .from("profiles")
      .select("id, metadata")
      .eq("auth_user_id", authUserId)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (!bayiProfile) {
      return NextResponse.json({ error: "Bu hesap bayi'ye kayıtlı değil." }, { status: 403 });
    }

    // Hızlı işlem tercihi — metadata.bayi_quick_actions, yoksa default
    const metaQuickActions = (bayiProfile.metadata as { bayi_quick_actions?: unknown } | null)?.bayi_quick_actions;
    const sanitized = sanitizeBayiQuickActions(metaQuickActions);
    const quickActions = sanitized && sanitized.length > 0 ? sanitized : DEFAULT_BAYI_QUICK_ACTIONS;

    // 5) KPI queries — hepsi bayi tenant_id ile filtreli
    const { data: statuses } = await sb
      .from("bayi_order_statuses")
      .select("id, code");
    const activeStatusIds = (statuses || [])
      .filter(s => ["pending", "preparing", "shipped", "in_transit", "delivering"].includes(s.code))
      .map(s => s.id);

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
        .eq("tenant_id", bayiTenantId).eq("is_active", true),
      activeStatusIds.length
        ? sb.from("bayi_orders").select("id", { count: "exact", head: true })
            .eq("tenant_id", bayiTenantId).in("status_id", activeStatusIds)
        : Promise.resolve({ count: 0 } as { count: number }),
      sb.from("bayi_dealer_invoices").select("id", { count: "exact", head: true })
        .eq("tenant_id", bayiTenantId).eq("is_paid", false),
      saleTypeId
        ? sb.from("bayi_dealer_transactions").select("amount, due_date")
            .eq("tenant_id", bayiTenantId).eq("transaction_type_id", saleTypeId)
            .lt("due_date", todayIso)
        : Promise.resolve({ data: [] } as { data: Array<{ amount: number; due_date: string }> }),
      sb.from("bayi_orders").select("total_amount")
        .eq("tenant_id", bayiTenantId).gte("created_at", monthStartIso),
      sb.from("bayi_products").select("id, stock_quantity, low_stock_threshold")
        .eq("tenant_id", bayiTenantId).eq("is_active", true),
      sb.from("bayi_invite_links").select("id", { count: "exact", head: true })
        .eq("tenant_id", bayiTenantId).eq("is_active", true),
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
      quickActions,
    });
  } catch (err) {
    console.error("[bayi-panel:dashboard]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
