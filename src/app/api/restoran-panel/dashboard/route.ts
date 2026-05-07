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
