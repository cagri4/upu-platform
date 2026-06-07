/**
 * DELETE /api/admin/saas/[key]/tenants/[id]?force=0|1
 *
 * 2026-06-06 Redesign D: yapısal tenant silme akışı.
 *
 * - force=0 (default): probe; doluysa 409 + { users[], dataCounts{}, is_demo }
 *   döner. Boşsa siler (200).
 * - force=1: cascade silme yapılır (bağımlı tüm tablolar + profiles + auth.user
 *   + tenant). DEMO ise ekstra audit log.
 *
 * Self-delete koruması: silinecek profile'lardan biri çağıran admin'e aitse
 * 403 döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

// tenant_id FK taşıyan tablolar — probe response'unda "kaç satır silinecek?"
// sayımı için kullanılır. 2026-06-07 migration'ı sonrası DB CASCADE'i
// otomatik temizliyor; bu liste yalnız UI'da "Silinecek: X satır" bilgisini
// göstermek için tutulur. Liste 2026-06-06 service-role probe çıktısı.
// TODO: pg_constraint sorgusu ile dinamik üret, hardcoded liste mimari borç.
const DEPENDENT_TABLES = [
  "agent_quotas", "command_sessions", "invite_codes", "magic_links", "audit_log",
  "bayi_dealers", "bayi_orders", "bayi_order_items", "bayi_products", "bayi_invoices",
  "bayi_payments", "bayi_stock_reservations", "bayi_credit_limit_audit",
  "bayi_product_visibility", "bayi_referrals", "bayi_scoring", "bayi_campaign_triggers",
  "bayi_recommendations", "bayi_churn_signals", "bayi_fair_use_audit", "bayi_vitrine",
  "rst_restaurants", "rst_employees", "rst_orders", "rst_menu_items", "rst_categories",
  "rst_loyalty_customers",
  "otel_hotels", "otel_rooms", "otel_reservations", "otel_user_hotels",
  "sy_buildings", "sy_sakinler", "sy_aidat", "sy_duyurular", "sy_arizalar",
  "emlak_properties", "emlak_customers", "emlak_presentations", "emlak_listings",
  "muh_invoices", "muh_clients", "muh_payments",
  "market_products", "market_orders", "market_suppliers",
  "user_progression", "quest_state", "tip_logs", "command_logs",
  "employee_progression", "customer_tracking", "daily_leads",
] as const;

interface RouteCtx { params: Promise<{ key: string; id: string }> }

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  const { key, id: tenantId } = await ctx.params;
  const cfg = getTenantByKey(key);
  if (!cfg) {
    return NextResponse.json({ error: "Bilinmeyen SaaS kategorisi." }, { status: 404 });
  }

  const sb = getServiceClient();

  const { data: tenant } = await sb
    .from("tenants")
    .select("id, saas_type, name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  }
  if (tenant.saas_type !== cfg.saasType) {
    return NextResponse.json({ error: "Müşteri bu SaaS kategorisine ait değil." }, { status: 400 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const isDemo = tenantId === cfg.tenantId;

  // Probe: kullanıcılar + dataCounts
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, auth_user_id, display_name, role")
    .eq("tenant_id", tenantId);

  const profileList = profiles ?? [];
  const selfHit = profileList.find((p) => p.id === auth.userId || p.auth_user_id === auth.userId);
  if (selfHit) {
    return NextResponse.json(
      { error: "Bu firma içinde kendi profilin var. Önce başka admin'e devret." },
      { status: 403 },
    );
  }

  const dataCounts: Record<string, number> = {};
  let dataTotal = 0;
  for (const tbl of DEPENDENT_TABLES) {
    const { count, error } = await sb
      .from(tbl)
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (error) continue; // tablo yok / column yok
    if ((count ?? 0) > 0) {
      dataCounts[tbl] = count ?? 0;
      dataTotal += count ?? 0;
    }
  }

  const userCount = profileList.length;
  const isEmpty = userCount === 0 && dataTotal === 0;

  if (!force && (!isEmpty || isDemo)) {
    return NextResponse.json(
      {
        confirmation_required: true,
        is_demo: isDemo,
        userCount,
        dataTotal,
        users: profileList.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          role: p.role,
        })),
        dataCounts,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      },
      { status: 409 },
    );
  }

  // force=1 (veya boş + non-DEMO) → cascade silme.
  //
  // 2026-06-07 migration (20260607181526_cascade_fk_standardization.sql)
  // sonrası tüm `tenant_id` FK'ları ON DELETE CASCADE, tüm `profile_id`/
  // `user_id` FK'ları SET NULL (NULLABLE) veya CASCADE (NOT NULL).
  //
  // Eski DEPENDENT_TABLES manuel liste artık gereksiz: tenant DELETE'i
  // DB seviyesinde tüm bağımlı satırları otomatik temizler.
  //
  // 1) Önce auth.users — `profiles` DB'den CASCADE ile gidecek ama
  //    auth.users (auth schema) FK kapsamında değil. Tek tek sil.
  for (const p of profileList) {
    if (p.auth_user_id) {
      const { error: authErr } = await sb.auth.admin.deleteUser(
        p.auth_user_id as string,
      );
      if (authErr) {
        console.error(
          "[admin/saas/tenants:DELETE] auth.deleteUser failed",
          p.auth_user_id,
          authErr,
        );
        return NextResponse.json(
          {
            error:
              "auth.users silinemedi (cascade etmedi); tenant silmeden durdu: " +
              authErr.message,
          },
          { status: 500 },
        );
      }
    }
  }

  // 2) tenant — DB CASCADE FK'ları tüm bağımlı satırları temizler.
  const { error: tDelErr } = await sb.from("tenants").delete().eq("id", tenantId);
  if (tDelErr) {
    console.error("[admin/saas/tenants:DELETE] tenant delete failed", tDelErr);
    return NextResponse.json(
      { error: "Tenant silinemedi: " + tDelErr.message },
      { status: 500 },
    );
  }

  console.log(
    `[admin/saas/tenants:DELETE] success tenant=${tenantId} slug=${tenant.slug}` +
      ` is_demo=${isDemo} users_deleted=${userCount} data_rows=${dataTotal}` +
      ` by_admin=${auth.userId}`,
  );

  return NextResponse.json({
    success: true,
    deleted: {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      users: userCount,
      data: dataTotal,
      is_demo: isDemo,
    },
  });
}
