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

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  const type = req.nextUrl.searchParams.get("type");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  if (!type) return NextResponse.json({ error: "type gerekli" }, { status: 400 });

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
