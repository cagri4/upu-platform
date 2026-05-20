import type { ToolDef } from "@/platform/agent/types";

export const getKpiSummaryTool: ToolDef = {
  name: "get_kpi_summary",
  description: "Bayi panelinin KPI özetini döner: aktif bayi sayısı, bekleyen sipariş, geçmiş tahsilat, bu ay ciro, kritik stok, aktif davet. Sabah özet / 'bugün ne var?' soruları için kullan.",
  input_schema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["today", "this_week", "this_month"],
        description: "Ciro hesaplama periyodu — şu an sadece this_month destekleniyor.",
      },
    },
  },
  async handler(_input, ctx) {
    const [
      dealerCountRes,
      pendingOrdersRes,
      activeOrdersRes,
      pendingInvoicesRes,
      monthOrdersRes,
      overdueInvoicesRes,
      activeInvitesRes,
    ] = await Promise.all([
      ctx.sb.from("bayi_dealers").select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId).eq("is_active", true),
      ctx.sb.from("bayi_dealer_orders").select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId).eq("status", "pending"),
      ctx.sb.from("bayi_dealer_orders").select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId).in("status", ["confirmed", "preparing", "shipped"]),
      ctx.sb.from("bayi_invoices").select("amount")
        .eq("tenant_id", ctx.tenantId).eq("status", "open"),
      ctx.sb.from("bayi_dealer_orders").select("total_amount")
        .eq("tenant_id", ctx.tenantId)
        .in("status", ["confirmed", "preparing", "shipped", "delivered"])
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ctx.sb.from("bayi_invoices").select("amount")
        .eq("tenant_id", ctx.tenantId).eq("status", "open")
        .lt("due_date", new Date().toISOString().slice(0, 10)),
      ctx.sb.from("dealer_invitations").select("id", { count: "exact", head: true })
        .eq("distributor_tenant_id", ctx.tenantId).eq("status", "pending"),
    ]);

    const monthRevenue = (monthOrdersRes.data || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const openInvoicesAmount = (pendingInvoicesRes.data || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const overdueAmount = (overdueInvoicesRes.data || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return {
      dealer_count: dealerCountRes.count || 0,
      pending_orders: pendingOrdersRes.count || 0,
      active_orders: activeOrdersRes.count || 0,
      open_invoices_amount_TRY: openInvoicesAmount,
      overdue_invoices_amount_TRY: overdueAmount,
      month_revenue_TRY: monthRevenue,
      active_invitations: activeInvitesRes.count || 0,
    };
  },
};
