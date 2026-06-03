/**
 * GET  /api/admin/bayi-dealers/[id]/product-visibility
 * POST /api/admin/bayi-dealers/[id]/product-visibility
 *
 * Bayi-spesifik ürün görünürlüğü yönetimi (#109).
 *
 * GET → bu bayinin tenant'ındaki tüm aktif ürünler + her biri için
 *       mevcut visibility durumu (visible=false → hidden, row yok →
 *       default visible).
 *
 * POST → bulk delta uygula:
 *   Body: { changes: [{ product_id, visible }], reason? }
 *   visible=false → upsert ile satır eklenir/güncellenir
 *   visible=true  → varsa satır silinir (default davranışa döner)
 *
 * Yetki: platform admin VEYA bayi tenant sahibi (role admin/user,
 * tenant_id match) — credit-limit endpoint'iyle aynı pattern.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

interface RouteCtx { params: Promise<{ id: string }> }

const TENANT_ADMIN_ROLES = new Set(["admin", "user"]);

async function resolveActor(req: NextRequest, dealerId: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: auth.error as NextResponse };
  const sb = getServiceClient();

  const { data: actor } = await sb
    .from("profiles")
    .select("id, role, tenant_id")
    .or(`id.eq.${auth.userId},auth_user_id.eq.${auth.userId}`)
    .maybeSingle();
  if (!actor) {
    return { error: NextResponse.json({ error: "Profil bulunamadı." }, { status: 403 }) };
  }

  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, tenant_id, company_name")
    .eq("id", dealerId)
    .maybeSingle();
  if (!dealer) {
    return { error: NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 }) };
  }

  const isPlatformAdmin = actor.role === "admin" && actor.tenant_id === null;
  const isTenantAdmin =
    TENANT_ADMIN_ROLES.has(actor.role || "") && actor.tenant_id === dealer.tenant_id;
  if (!isPlatformAdmin && !isTenantAdmin) {
    return {
      error: NextResponse.json(
        { error: "Bu bayinin ürün görünürlüğünü yönetme yetkiniz yok." },
        { status: 403 },
      ),
    };
  }
  return { sb, actor, dealer };
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id: dealerId } = await ctx.params;
  const ctxRes = await resolveActor(req, dealerId);
  if ("error" in ctxRes) return ctxRes.error;
  const { sb, dealer } = ctxRes;

  const { data: products, error: prodErr } = await sb
    .from("bayi_products")
    .select("id, code, name, brand, category, unit_price, base_price, is_active, stock_quantity")
    .eq("tenant_id", dealer.tenant_id)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (prodErr) {
    console.error("[product-visibility/GET]", prodErr);
    return NextResponse.json({ error: "Ürün listesi alınamadı." }, { status: 500 });
  }

  const { data: hidden } = await sb
    .from("bayi_product_visibility")
    .select("product_id, reason, updated_at")
    .eq("dealer_id", dealerId)
    .eq("visible", false);
  const hiddenMap = new Map<string, { reason: string | null; updated_at: string }>(
    (hidden || []).map((r) => [r.product_id as string, { reason: r.reason as string | null, updated_at: r.updated_at as string }]),
  );

  return NextResponse.json({
    ok: true,
    dealer_id: dealerId,
    dealer_name: dealer.company_name,
    rows: (products || []).map((p) => {
      const h = hiddenMap.get(p.id as string);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand,
        category: p.category,
        unitPrice: Number(p.unit_price) || Number(p.base_price) || 0,
        stockQuantity: Number(p.stock_quantity) || 0,
        visible: !h,
        hiddenReason: h?.reason ?? null,
        hiddenAt: h?.updated_at ?? null,
      };
    }),
    hidden_count: hiddenMap.size,
  });
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: dealerId } = await ctx.params;
  const ctxRes = await resolveActor(req, dealerId);
  if ("error" in ctxRes) return ctxRes.error;
  const { sb, actor, dealer } = ctxRes;

  let body: { changes?: Array<{ product_id?: string; visible?: boolean }>; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length === 0) {
    return NextResponse.json({ error: "changes alanı zorunlu." }, { status: 400 });
  }

  const reason = (body.reason || "").trim().slice(0, 500) || null;

  // visible=false → upsert hidden satırı
  // visible=true  → satır varsa sil
  const toHide = changes.filter((c) => c.product_id && c.visible === false);
  const toShow = changes.filter((c) => c.product_id && c.visible === true);

  let hiddenWritten = 0;
  let shownDeleted = 0;

  if (toHide.length > 0) {
    const upsertPayload = toHide.map((c) => ({
      tenant_id: dealer.tenant_id,
      dealer_id: dealerId,
      product_id: c.product_id as string,
      visible: false,
      reason,
      updated_at: new Date().toISOString(),
      updated_by_user_id: actor.id,
    }));
    const { error, count } = await sb
      .from("bayi_product_visibility")
      .upsert(upsertPayload, { onConflict: "dealer_id,product_id", count: "exact" });
    if (error) {
      console.error("[product-visibility/POST upsert]", error);
      return NextResponse.json({ error: "Gizleme kaydedilemedi.", details: error.message }, { status: 500 });
    }
    hiddenWritten = count ?? toHide.length;
  }

  if (toShow.length > 0) {
    const productIds = toShow.map((c) => c.product_id as string);
    const { error, count } = await sb
      .from("bayi_product_visibility")
      .delete({ count: "exact" })
      .eq("dealer_id", dealerId)
      .in("product_id", productIds);
    if (error) {
      console.error("[product-visibility/POST delete]", error);
      return NextResponse.json({ error: "Gösterme güncellenemedi.", details: error.message }, { status: 500 });
    }
    shownDeleted = count ?? productIds.length;
  }

  console.log(
    `[product-visibility] ${actor.id} updated dealer ${dealerId} ` +
    `(${dealer.company_name}) — hidden+${hiddenWritten}, shown+${shownDeleted}`,
  );

  return NextResponse.json({
    ok: true,
    dealer_id: dealerId,
    hidden_written: hiddenWritten,
    shown_deleted: shownDeleted,
  });
}
