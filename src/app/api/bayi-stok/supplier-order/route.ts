/**
 * POST /api/bayi-stok/supplier-order — manuel tedarikçi sipariş kaydı.
 *
 * stock_quantity'i ETKILEMEZ; "yolda" notu olarak movement log'a yazar.
 * Mal teslim alındığında /api/bayi-stok/move (type='in') ile gerçek giriş
 * yapılır (workflow: supplier_order log + receive → in).
 *
 * Body: { product_id, quantity, supplier_name?, expected_arrival?, unit_cost?, reason? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "user", "depocu"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const productId = String(body.product_id || "").trim();
  const qty = Number(body.quantity);
  const supplierName = body.supplier_name ? String(body.supplier_name).trim() : null;
  const expectedArrival = body.expected_arrival ? String(body.expected_arrival).trim() : null;
  const unitCost = body.unit_cost !== undefined && body.unit_cost !== null && body.unit_cost !== ""
    ? Number(body.unit_cost) : null;
  const reason = body.reason ? String(body.reason).trim() : null;

  if (!productId) return NextResponse.json({ error: "product_id gerekli." }, { status: 400 });
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Geçerli miktar girin." }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null; invited_by: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ALLOWED_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Depo yetkisi gerekli." }, { status: 403 });
  }
  const tenantId = lookup.tenantId;
  const ownerId = lookup.profile.invited_by || lookup.profile.id;

  const { data: product } = await sb
    .from("bayi_products")
    .select("id, name")
    .eq("id", productId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const { data: inserted, error } = await sb
    .from("bayi_stock_movements")
    .insert({
      tenant_id: tenantId,
      product_id: productId,
      movement_type: "supplier_order",
      quantity: qty,
      reason: reason || `${supplierName || "Tedarikçi"} siparişi`,
      supplier_name: supplierName,
      expected_arrival: expectedArrival,
      unit_cost: unitCost,
      reference_type: "supplier",
      created_by: lookup.profile.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: inserted.id });
}
