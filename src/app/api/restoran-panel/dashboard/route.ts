/**
 * GET /api/restoran-panel/dashboard?t=<token>
 *
 * Restoran dashboard 6 KPI:
 *   - today_reservations    bugün rezervasyon (kişi sayı dahil)
 *   - free_tables           boş masa
 *   - member_count          aktif müdavim
 *   - week_revenue          son 7 gün ödenmiş sipariş cirosu
 *   - today_birthdays       bugün doğum günü olan müdavim
 *   - critical_stock        kritik stok kalem sayısı
 *
 * Pattern: emlak /api/panel/dashboard — Promise.all paralel sorgular,
 * tenant_id'ye scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ("error" in auth) return auth.error;

    const sb = getServiceClient();
    const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
      userId: auth.userId,
      tenantKey: "restoran",
      select: "tenant_id",
    });
    if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    const tenantId = lookup.tenantId;

    const today = new Date().toISOString().slice(0, 10);
    const todayMD = today.slice(5);
    const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      reservationsTodayRes,
      reservationsTodayPartyRes,
      tablesRes,
      memberCountRes,
      weekOrdersRes,
      birthdaysRes,
      criticalStockRes,
    ] = await Promise.all([
      sb.from("rst_reservations").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("reserved_at", `${today}T00:00:00`)
        .lte("reserved_at", `${today}T23:59:59`)
        .not("status", "in", "(cancelled,no_show)"),
      sb.from("rst_reservations").select("party_size")
        .eq("tenant_id", tenantId)
        .gte("reserved_at", `${today}T00:00:00`)
        .lte("reserved_at", `${today}T23:59:59`)
        .not("status", "in", "(cancelled,no_show)"),
      sb.from("rst_tables").select("status")
        .eq("tenant_id", tenantId).eq("is_active", true),
      sb.from("rst_loyalty_members").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true),
      sb.from("rst_orders").select("total_amount")
        .eq("tenant_id", tenantId).eq("status", "paid")
        .gte("created_at", weekAgoIso),
      sb.from("rst_loyalty_members").select("id, guest_name", { count: "exact" })
        .eq("tenant_id", tenantId).eq("is_active", true).eq("birthday", todayMD),
      sb.from("rst_inventory").select("id, name, quantity, low_threshold, unit")
        .eq("tenant_id", tenantId).eq("is_active", true)
        .not("low_threshold", "is", null),
    ]);

    const tables = tablesRes.data || [];
    const totalTables = tables.length;
    const freeTables = tables.filter(t => t.status === "free").length;
    const occupiedTables = tables.filter(t => t.status === "occupied").length;

    const reservationGuests = (reservationsTodayPartyRes.data || []).reduce((s, r) => s + (r.party_size || 0), 0);
    const weekRevenue = (weekOrdersRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);

    const critical = (criticalStockRes.data || []).filter(i =>
      i.low_threshold != null && i.quantity <= i.low_threshold
    );

    return NextResponse.json({
      kpis: {
        today_reservations: reservationsTodayRes.count || 0,
        today_reservation_guests: reservationGuests,
        free_tables: freeTables,
        occupied_tables: occupiedTables,
        total_tables: totalTables,
        member_count: memberCountRes.count || 0,
        week_revenue: weekRevenue,
        today_birthdays: birthdaysRes.count || 0,
        today_birthday_names: (birthdaysRes.data || []).map(m => m.guest_name as string),
        critical_stock: critical.length,
        critical_stock_items: critical.slice(0, 5).map(i => ({
          name: i.name as string,
          quantity: i.quantity as number,
          unit: (i.unit as string) || "",
        })),
      },
    });
  } catch (err) {
    console.error("[restoran-panel:dashboard]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
