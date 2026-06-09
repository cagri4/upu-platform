/**
 * GET /api/dagitici/fiyat-resolve?dealer_id=...&product_id=...&miktar=...
 *
 * Debug/test helper — resolveDealerPrice() sonucunu döner.
 * UI sipariş ekranında da kullanılır (cart kademe iskontosunu canlı hesaplamak için).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";
import { resolveDealerPrice } from "@/platform/bayi/resolve-dealer-price";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const dealerId = url.searchParams.get("dealer_id");
  const productId = url.searchParams.get("product_id");
  const miktarStr = url.searchParams.get("miktar") || "1";
  const quantity = Math.max(1, parseInt(miktarStr, 10) || 1);

  if (!dealerId || !productId) {
    return NextResponse.json(
      { error: "dealer_id ve product_id zorunlu." },
      { status: 400 },
    );
  }

  const result = await resolveDealerPrice(sb, {
    tenantId,
    dealerId,
    productId,
    quantity,
  });

  if (!result) {
    return NextResponse.json(
      { error: "Ürün veya bayi bulunamadı." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    quantity,
    ...result,
  });
}
