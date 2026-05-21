/**
 * POST /api/bayi-stok/move — manuel stok hareketi kaydet.
 * Body: { product_id, type: 'in'|'out'|'adjust', quantity, reason?, unit_cost? }
 *
 * - in       : stock_quantity += quantity
 * - out      : stock_quantity -= quantity (negatife düşmez, 0'a clamp)
 * - adjust   : quantity delta olabilir (pozitif veya negatif gönderilir)
 *
 * bayi_stock_movements'a log + bayi_products.stock_quantity atomik update.
 * Admin + depocu yetkili.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "user", "depocu"]);
const VALID_TYPES = new Set(["in", "out", "adjust"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const productId = String(body.product_id || "").trim();
  const type = String(body.type || "").trim();
  const qty = Number(body.quantity);
  const reason = body.reason ? String(body.reason).trim() : null;
  const unitCost = body.unit_cost !== undefined && body.unit_cost !== null && body.unit_cost !== ""
    ? Number(body.unit_cost) : null;

  if (!productId) return NextResponse.json({ error: "product_id gerekli." }, { status: 400 });
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "type 'in'/'out'/'adjust' olmalı." }, { status: 400 });
  if (!Number.isFinite(qty) || qty === 0) {
    return NextResponse.json({ error: "Geçerli miktar girin (sıfırdan farklı)." }, { status: 400 });
  }
  if (type !== "adjust" && qty < 0) {
    return NextResponse.json({ error: "in/out için miktar pozitif olmalı." }, { status: 400 });
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
    .select("id, stock_quantity, user_id, name")
    .eq("id", productId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const current = Number(product.stock_quantity) || 0;
  const delta = type === "in" ? qty : type === "out" ? -qty : qty;  // adjust delta as-is
  const newStock = Math.max(0, current + delta);

  const { error: movErr } = await sb.from("bayi_stock_movements").insert({
    tenant_id: tenantId,
    product_id: productId,
    movement_type: type,
    quantity: Math.abs(qty),
    reason,
    unit_cost: unitCost,
    created_by: lookup.profile.id,
  });
  if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 });

  const { error: updErr } = await sb
    .from("bayi_products")
    .update({ stock_quantity: newStock })
    .eq("id", productId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ success: true, newStock, productName: product.name });
}
