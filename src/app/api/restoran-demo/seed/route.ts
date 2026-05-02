/**
 * POST /api/restoran-demo/seed
 *
 * Restoran tenant'ına Sultan Ahmet Kebabevi demo verisini yükler.
 *
 * İki çalışma modu:
 *   1. Magic-token (production-safe): owner WA'da `/demoyukle` çağırır,
 *      magic_link_tokens kaydı + 2h link → /api/restoran-demo/seed?token=...
 *   2. Admin-secret (demo prep): query param ?secret=<DEMO_SECRET env>
 *      ve ?tenant_id=<uuid> ile direkt yükleme. Demo öncesi ortamı
 *      hazırlamak için kullanılır.
 *
 * Mevcut veri varsa: ?force=1 olmadan 409 döner. Force ile rst_*
 * tablolarındaki tenant verisi silinip yeniden yazılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  DEMO_TABLES, DEMO_MENU, DEMO_INVENTORY, DEMO_LOYALTY,
  DEMO_PAID_ORDERS, DEMO_RESERVATIONS,
} from "@/tenants/restoran/demo-import/sultan-ahmet";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SeedResult {
  tables: number;
  menu_items: number;
  inventory: number;
  loyalty_members: number;
  paid_orders: number;
  order_items: number;
  reservations: number;
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  // Kolay test için GET de destekleniyor (browser'dan tetiklenebilir)
  return handle(req);
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const secret = url.searchParams.get("secret");
  const tenantIdParam = url.searchParams.get("tenant_id");
  const force = url.searchParams.get("force") === "1";

  const supabase = getServiceClient();
  let tenantId: string | null = null;
  let ownerId: string | null = null;

  // ── Auth Mode 1: magic-token ───────────────────────────────────────────
  if (token) {
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, role")
      .eq("id", magicToken.user_id)
      .maybeSingle();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });
    if (profile.role !== "admin" && profile.role !== "user") {
      return NextResponse.json({ error: "Sadece sahip demo veri yükleyebilir." }, { status: 403 });
    }
    tenantId = profile.tenant_id;
    ownerId = profile.id;
  }
  // ── Auth Mode 2: admin-secret ──────────────────────────────────────────
  else if (secret && process.env.DEMO_SEED_SECRET && secret === process.env.DEMO_SEED_SECRET) {
    tenantId = tenantIdParam || getTenantByKey("restoran")?.tenantId || null;
    if (!tenantId) return NextResponse.json({ error: "tenant_id gerekli." }, { status: 400 });
    // owner_id opsiyonel — yoksa null kalır (siparişlerin created_by'ı null olur)
  } else {
    return NextResponse.json({ error: "Auth: ?token= veya ?secret= gerekli." }, { status: 401 });
  }

  // ── Mevcut veri kontrolü ───────────────────────────────────────────────
  const { count: existingTables } = await supabase
    .from("rst_tables")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if ((existingTables || 0) > 0 && !force) {
    return NextResponse.json({
      error: "Tenant'ta zaten masa kaydı var. ?force=1 ile silip yeniden yükleyin.",
      existing_tables: existingTables,
    }, { status: 409 });
  }

  // ── Force mode: mevcut veriyi temizle ──────────────────────────────────
  if (force) {
    await supabase.from("rst_order_items").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_orders").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_reservations").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_loyalty_visits").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_loyalty_members").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_inventory").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_menu_items").delete().eq("tenant_id", tenantId);
    await supabase.from("rst_tables").delete().eq("tenant_id", tenantId);
  }

  const result: SeedResult = {
    tables: 0, menu_items: 0, inventory: 0, loyalty_members: 0,
    paid_orders: 0, order_items: 0, reservations: 0,
  };

  // ── 1. Masalar ─────────────────────────────────────────────────────────
  const { data: insertedTables } = await supabase
    .from("rst_tables")
    .insert(DEMO_TABLES.map(t => ({
      tenant_id: tenantId,
      label: t.label,
      capacity: t.capacity,
      zone: t.zone,
      status: t.status,
      is_active: true,
    })))
    .select("id, label");
  result.tables = insertedTables?.length || 0;
  const tableIdByLabel: Record<string, string> = {};
  for (const t of insertedTables || []) tableIdByLabel[t.label as string] = t.id as string;

  // ── 2. Menü kalemleri ──────────────────────────────────────────────────
  const { data: insertedMenu } = await supabase
    .from("rst_menu_items")
    .insert(DEMO_MENU.map(m => ({
      tenant_id: tenantId,
      name: m.name,
      description: m.description || null,
      category: m.category,
      price: m.price,
      prep_minutes: m.prep_minutes || null,
      is_available: true,
      is_active: true,
    })))
    .select("id, name");
  result.menu_items = insertedMenu?.length || 0;
  const menuIds: string[] = (insertedMenu || []).map(m => m.id as string);

  // ── 3. Stok ────────────────────────────────────────────────────────────
  const { data: insertedInv } = await supabase
    .from("rst_inventory")
    .insert(DEMO_INVENTORY.map(i => ({
      tenant_id: tenantId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      low_threshold: i.low_threshold,
      supplier_name: i.supplier_name || null,
      is_active: true,
    })))
    .select("id");
  result.inventory = insertedInv?.length || 0;

  // ── 4. Müdavimler ──────────────────────────────────────────────────────
  const memberRows = DEMO_LOYALTY.map(m => {
    const lastVisit = new Date();
    lastVisit.setDate(lastVisit.getDate() - m.days_since_last_visit);
    const firstVisit = new Date(lastVisit);
    firstVisit.setMonth(firstVisit.getMonth() - Math.max(2, m.visit_count));
    return {
      tenant_id: tenantId,
      guest_phone: m.phone,
      guest_name: m.name,
      birthday: m.birthday || null,
      first_visit_at: firstVisit.toISOString(),
      last_visit_at: lastVisit.toISOString(),
      visit_count: m.visit_count,
      total_spent: m.total_spent,
      favorite_items: m.favorite_items || [],
      notes: m.notes || null,
      marketing_opt_in: true,
      source: "import",
      is_active: true,
    };
  });
  const { data: insertedMembers } = await supabase
    .from("rst_loyalty_members")
    .insert(memberRows)
    .select("id, guest_phone");
  result.loyalty_members = insertedMembers?.length || 0;
  const memberIdByPhone: Record<string, string> = {};
  for (const m of insertedMembers || []) memberIdByPhone[m.guest_phone as string] = m.id as string;

  // ── 5. Dünkü ödenmiş siparişler ────────────────────────────────────────
  let orderNo = 1001;
  const orderItemsBuf: Array<Record<string, unknown>> = [];
  for (const o of DEMO_PAID_ORDERS) {
    const createdAt = new Date(Date.now() - o.hours_ago * 3600 * 1000);
    const paidAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    const tableId = o.table_label !== "Paket" ? tableIdByLabel[o.table_label] || null : null;
    const memberPhone = o.loyalty_member_index !== undefined ? DEMO_LOYALTY[o.loyalty_member_index]?.phone : undefined;
    const memberId = memberPhone ? memberIdByPhone[memberPhone] : null;

    const { data: orderRow } = await supabase
      .from("rst_orders")
      .insert({
        tenant_id: tenantId,
        order_number: String(orderNo++),
        table_id: tableId,
        table_label: o.table_label !== "Paket" ? o.table_label : null,
        order_type: o.order_type,
        status: "paid",
        subtotal: o.total_amount,
        tax_amount: 0,
        discount: 0,
        total_amount: o.total_amount,
        guest_count: o.guest_count,
        guest_phone: memberPhone || null,
        loyalty_member_id: memberId,
        created_by: ownerId,
        served_at: paidAt.toISOString(),
        paid_at: paidAt.toISOString(),
        created_at: createdAt.toISOString(),
      })
      .select("id")
      .single();

    if (!orderRow) continue;
    result.paid_orders++;

    for (const item of o.items) {
      const menuItem = DEMO_MENU[item.menu_index];
      const menuId = menuIds[item.menu_index] || null;
      if (!menuItem) continue;
      orderItemsBuf.push({
        tenant_id: tenantId,
        order_id: orderRow.id,
        menu_item_id: menuId,
        item_name: menuItem.name,
        quantity: item.quantity,
        unit_price: menuItem.price,
        total_price: menuItem.price * item.quantity,
        status: "served",
        created_at: createdAt.toISOString(),
      });
    }
  }
  if (orderItemsBuf.length) {
    const { data: insertedItems } = await supabase
      .from("rst_order_items")
      .insert(orderItemsBuf)
      .select("id");
    result.order_items = insertedItems?.length || 0;
  }

  // ── 6. Rezervasyonlar ──────────────────────────────────────────────────
  const reservationRows = DEMO_RESERVATIONS.map(r => {
    const reservedAt = new Date(Date.now() + r.hours_from_now * 3600 * 1000);
    const memberPhone = r.loyalty_member_index !== undefined ? DEMO_LOYALTY[r.loyalty_member_index]?.phone : undefined;
    const memberId = memberPhone ? memberIdByPhone[memberPhone] : null;
    const tableId = r.table_label ? tableIdByLabel[r.table_label] || null : null;
    return {
      tenant_id: tenantId,
      guest_name: r.guest_name,
      guest_phone: r.guest_phone,
      party_size: r.party_size,
      reserved_at: reservedAt.toISOString(),
      duration_minutes: 90,
      table_id: tableId,
      table_label: r.table_label || null,
      status: r.status,
      source: r.source,
      notes: r.notes || null,
      loyalty_member_id: memberId,
      created_by: ownerId,
    };
  });
  const { data: insertedRes } = await supabase
    .from("rst_reservations")
    .insert(reservationRows)
    .select("id");
  result.reservations = insertedRes?.length || 0;

  return NextResponse.json({
    ok: true,
    tenant_id: tenantId,
    seeded: result,
    message: "Sultan Ahmet Kebabevi demo verisi yüklendi.",
  });
}
