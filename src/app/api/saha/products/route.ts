/**
 * GET /api/saha/products?q= — sipariş için aktif ürün listesi (arama).
 *
 * Saha elemanı ziyarette bayi adına sipariş girerken ürün seçer. Birim
 * fiyat siparişte sunucuda yeniden hesaplanır (resolveDealerPrice); burada
 * referans için base_price gösterilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSahaAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getSahaAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  let query = sb
    .from("bayi_products")
    .select("id, code, name, base_price, stock_quantity")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(100);
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[saha:products]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((p) => ({
      id: p.id as string,
      code: p.code as string,
      name: p.name as string,
      basePrice: Number(p.base_price) || 0,
      stock: Number(p.stock_quantity) || 0,
    })),
  });
}
