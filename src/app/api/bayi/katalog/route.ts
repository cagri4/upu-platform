/**
 * GET /api/bayi/katalog — alıcı katalog listesi.
 *   query: q, category_id, brand, in_stock=1, sort, page, pageSize
 *
 * Görünürlük katmanı:
 *   - Sadece is_active=true ürünler
 *   - bayi_product_visibility ile dealer-özel hidden olanlar elenir
 *
 * Fiyat: bu endpoint base_price dönder (hızlı liste). Kademe/liste fiyatı
 * /api/bayi/fiyat-resolve veya ürün detayda hesaplanır (slow path).
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 200;
const SORT_OPTIONS = ["newest", "name_asc", "price_asc", "price_desc"] as const;

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const categoryId = url.searchParams.get("category_id") || "";
  const brand = url.searchParams.get("brand")?.trim() || "";
  const inStock = url.searchParams.get("in_stock") === "1";
  const sort = url.searchParams.get("sort") || "newest";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSizeRaw = parseInt(
    url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`,
    10,
  );
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSizeRaw));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Bayinin dealer kaydı (visibility ve favorite kontrol için)
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  // Gizlenmiş ürün id'leri (dealer-özel)
  const hiddenIds = new Set<string>();
  if (dealerId) {
    const { data: hidden } = await sb
      .from("bayi_product_visibility")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .eq("dealer_id", dealerId)
      .eq("visible", false);
    (hidden ?? []).forEach((h) => hiddenIds.add(h.product_id as string));
  }

  let query = sb
    .from("bayi_products")
    .select(
      "id, code, name, description, base_price, unit, image_url, stock_quantity, low_stock_threshold, category_id, brand, barcode, updated_at, created_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (q) {
    const safe = q.replace(/[,()]/g, "");
    query = query.or(
      `code.ilike.%${safe}%,name.ilike.%${safe}%,barcode.ilike.%${safe}%,brand.ilike.%${safe}%`,
    );
  }
  if (categoryId) query = query.eq("category_id", categoryId);
  if (brand) query = query.eq("brand", brand);
  if (inStock) query = query.gt("stock_quantity", 0);

  // Sıralama
  if (sort === "name_asc") query = query.order("name", { ascending: true });
  else if (sort === "price_asc") query = query.order("base_price", { ascending: true });
  else if (sort === "price_desc") query = query.order("base_price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[bayi:katalog:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  let items = (data ?? []).filter((p) => !hiddenIds.has(p.id as string));

  // Favori id seti
  const favIds = new Set<string>();
  if (items.length > 0) {
    const ids = items.map((p) => p.id as string);
    const { data: favs } = await sb
      .from("bayi_favorites")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .in("product_id", ids);
    (favs ?? []).forEach((f) => favIds.add(f.product_id as string));
  }

  const mapped = items.map((p) => ({
    id: p.id as string,
    code: (p.code as string) || "",
    name: (p.name as string) || "",
    description: (p.description as string) || null,
    basePrice: Number(p.base_price ?? 0),
    unit: (p.unit as string) || "adet",
    imageUrl: (p.image_url as string) || null,
    stockQuantity: Number(p.stock_quantity ?? 0),
    lowStockThreshold:
      p.low_stock_threshold != null ? Number(p.low_stock_threshold) : null,
    categoryId: (p.category_id as string) || null,
    brand: (p.brand as string) || null,
    barcode: (p.barcode as string) || null,
    isFavorite: favIds.has(p.id as string),
  }));

  // Kategoriler ve markaları çek (filter UI dropdown için)
  const { data: cats } = await sb
    .from("bayi_categories")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  const { data: brandRows } = await sb
    .from("bayi_products")
    .select("brand")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("brand", "is", null);
  const brandSet = new Set<string>();
  (brandRows ?? []).forEach((b) => {
    const v = (b.brand as string)?.trim();
    if (v) brandSet.add(v);
  });

  return NextResponse.json({
    success: true,
    items: mapped,
    total: count ?? mapped.length,
    page,
    pageSize,
    facets: {
      categories: (cats ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      })),
      brands: Array.from(brandSet).sort(),
    },
    sortOptions: SORT_OPTIONS,
  });
}
