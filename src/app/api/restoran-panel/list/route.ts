/**
 * GET /api/restoran-panel/list?t=<token>&type=<entity>
 *
 * Restoran panel list pages için tek endpoint. type:
 *   - reservations  → bugün+yarın rezervasyonlar (status active)
 *   - tables        → tüm aktif masalar (zone+status sıralı)
 *   - members       → müdavimler (last_visit_at desc)
 *   - menu          → menü kalemleri (category sıralı)
 *
 * Token doğrula → tenant_id resolve → ilgili tabloyu çek → JSON.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "type gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ tenant_id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "restoran",
    select: "tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const tenantId = lookup.tenantId;

  switch (type) {
    case "reservations": {
      const today = new Date().toISOString().slice(0, 10);
      const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const { data } = await sb.from("rst_reservations")
        .select("id, guest_name, guest_phone, party_size, reserved_at, table_label, status, source, notes, loyalty_member_id")
        .eq("tenant_id", tenantId)
        .gte("reserved_at", `${today}T00:00:00`)
        .lte("reserved_at", `${dayAfter}T23:59:59`)
        .order("reserved_at");
      return NextResponse.json({ items: data || [] });
    }
    case "tables": {
      const { data } = await sb.from("rst_tables")
        .select("id, label, capacity, zone, status, current_check_amount")
        .eq("tenant_id", tenantId).eq("is_active", true)
        .order("zone").order("label");
      return NextResponse.json({ items: data || [] });
    }
    case "members": {
      const { data } = await sb.from("rst_loyalty_members")
        .select("id, guest_name, guest_phone, birthday, visit_count, total_spent, last_visit_at, favorite_items, notes")
        .eq("tenant_id", tenantId).eq("is_active", true)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .limit(100);
      return NextResponse.json({ items: data || [] });
    }
    case "menu": {
      const { data } = await sb.from("rst_menu_items")
        .select("id, name, description, category, price, is_available, prep_minutes")
        .eq("tenant_id", tenantId).eq("is_active", true)
        .order("category").order("name");
      return NextResponse.json({ items: data || [] });
    }
    default:
      return NextResponse.json({ error: "Bilinmeyen type" }, { status: 400 });
  }
}
