/**
 * GET  /api/bayi/sepet — açık sepeti döner (line item + ürün adı).
 * PUT  /api/bayi/sepet — sepeti TOPLU sync (localStorage → DB upsert).
 *   body: { lines: [{product_id, quantity}], coupon_code?, notes? }
 *
 * POST /api/bayi/sepet — tek bir satır ekle (delta).
 *   body: { product_id, quantity }
 *
 * Sepet üzerinde tüm değişikliklerin DB'ye yansıması:
 *   - Sprint B'de localStorage → hızlı UI
 *   - Sprint C'de bu endpoint çağrılır → cross-device + offline geri kazanım
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

async function ensureOpenCart(
  sb: ReturnType<typeof Object>,
  tenantId: string,
  userId: string,
  dealerId: string | null,
): Promise<string | null> {
  const supabase = sb as ReturnType<typeof import("@/platform/auth/supabase").getServiceClient>;
  const { data: existing } = await supabase
    .from("bayi_carts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("bayi_carts")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      dealer_id: dealerId,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[bayi:sepet:ensure]", error);
    return null;
  }
  return data.id as string;
}

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const { data: cart } = await sb
    .from("bayi_carts")
    .select("id, status, coupon_code, notes, updated_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();

  if (!cart) {
    return NextResponse.json({
      success: true,
      cart: null,
      lines: [],
    });
  }

  const { data: items } = await sb
    .from("bayi_cart_items")
    .select(
      "id, product_id, quantity, unit_price, added_at, bayi_products(code, name, unit, base_price, image_url, stock_quantity)",
    )
    .eq("tenant_id", tenantId)
    .eq("cart_id", cart.id);

  const lines = (items ?? []).map((it) => {
    const raw = it.bayi_products as unknown;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const p = (arr[0] ?? null) as
      | { code: string; name: string; unit: string; base_price: number; image_url: string | null; stock_quantity: number }
      | null;
    return {
      id: it.id as string,
      productId: it.product_id as string,
      productCode: p?.code ?? "",
      productName: p?.name ?? "",
      unit: p?.unit ?? "adet",
      basePrice: p ? Number(p.base_price) : 0,
      imageUrl: p?.image_url ?? null,
      stockQuantity: p ? Number(p.stock_quantity) : 0,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      addedAt: it.added_at as string,
    };
  });

  return NextResponse.json({
    success: true,
    cart: {
      id: cart.id as string,
      couponCode: (cart.coupon_code as string) || null,
      notes: (cart.notes as string) || null,
      updatedAt: cart.updated_at as string,
    },
    lines,
  });
}

interface SyncBody {
  lines?: Array<{ product_id?: string; quantity?: number | string; unit_price?: number | string }>;
  coupon_code?: string | null;
  notes?: string | null;
}

export async function PUT(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const inputLines = Array.isArray(body.lines) ? body.lines : [];

  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  const cartId = await ensureOpenCart(sb, tenantId, userId, dealerId);
  if (!cartId) return NextResponse.json({ error: "Sepet oluşturulamadı." }, { status: 500 });

  // Header güncelle
  await sb
    .from("bayi_carts")
    .update({
      coupon_code: body.coupon_code ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", cartId);

  // Mevcut item'ları temizle, yenileri ekle (basit sync)
  await sb
    .from("bayi_cart_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("cart_id", cartId);

  const rows = inputLines
    .filter((l) => l.product_id && Number(l.quantity) > 0)
    .map((l) => ({
      tenant_id: tenantId,
      cart_id: cartId,
      product_id: l.product_id as string,
      quantity: Math.floor(Number(l.quantity)),
      unit_price: l.unit_price != null ? Number(l.unit_price) : 0,
    }));

  if (rows.length > 0) {
    const { error } = await sb.from("bayi_cart_items").insert(rows);
    if (error) {
      console.error("[bayi:sepet:sync:insert]", error);
      return NextResponse.json({ error: "Sepet yazılamadı." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, cartId, lineCount: rows.length });
}

interface AddBody {
  product_id?: string;
  quantity?: number | string;
}

export async function POST(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as AddBody;
  const productId = (body.product_id || "").trim();
  const quantity = Math.max(1, Number(body.quantity ?? 1));
  if (!productId) return NextResponse.json({ error: "product_id gerekli." }, { status: 400 });

  const { data: prod } = await sb
    .from("bayi_products")
    .select("id, base_price")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (!prod) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  const cartId = await ensureOpenCart(sb, tenantId, userId, dealerId);
  if (!cartId) return NextResponse.json({ error: "Sepet oluşturulamadı." }, { status: 500 });

  const { data: existing } = await sb
    .from("bayi_cart_items")
    .select("id, quantity")
    .eq("tenant_id", tenantId)
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await sb
      .from("bayi_cart_items")
      .update({ quantity: Number(existing.quantity) + quantity })
      .eq("tenant_id", tenantId)
      .eq("id", existing.id);
  } else {
    await sb.from("bayi_cart_items").insert({
      tenant_id: tenantId,
      cart_id: cartId,
      product_id: productId,
      quantity,
      unit_price: Number(prod.base_price ?? 0),
    });
  }

  return NextResponse.json({ success: true, cartId });
}
