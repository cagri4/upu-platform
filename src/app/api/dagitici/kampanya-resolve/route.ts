/**
 * POST /api/dagitici/kampanya-resolve
 *   body: {
 *     dealer_id: string,
 *     cart: [{ product_id, quantity, unit_price, category_id? }],
 *     coupon_code?: string
 *   }
 *
 * resolveCampaignsFor() motor sonucunu döner. Faz 2'de bayi-side
 * checkout'unda çağrılacak; şimdi dağıtıcı tarafında "Performans" sekmesi
 * preview için.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";
import { resolveCampaignsFor, type CartLine } from "@/platform/bayi/resolve-campaigns";

export const dynamic = "force-dynamic";

interface ResolveBody {
  dealer_id?: string;
  cart?: Array<{
    product_id?: string;
    quantity?: number | string;
    unit_price?: number | string;
    category_id?: string | null;
  }>;
  coupon_code?: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const body = (await req.json().catch(() => ({}))) as ResolveBody;
  const dealerId = (body.dealer_id || "").trim();
  const cartInput = body.cart;
  if (!dealerId || !Array.isArray(cartInput) || cartInput.length === 0) {
    return NextResponse.json(
      { error: "dealer_id ve cart (boş olmayan dizi) zorunlu." },
      { status: 400 },
    );
  }

  const cart: CartLine[] = cartInput
    .filter((l) => l.product_id && l.quantity && l.unit_price != null)
    .map((l) => ({
      productId: l.product_id as string,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      categoryId: l.category_id ?? null,
    }));

  if (cart.length === 0) {
    return NextResponse.json({ error: "Geçerli cart satırı yok." }, { status: 400 });
  }

  const result = await resolveCampaignsFor(sb, {
    tenantId,
    dealerId,
    cart,
    couponCode: body.coupon_code ?? null,
  });

  return NextResponse.json({ success: true, ...result });
}
