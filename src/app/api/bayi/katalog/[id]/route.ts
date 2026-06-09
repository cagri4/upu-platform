/**
 * GET /api/bayi/katalog/[id] — alıcı ürün detay.
 *
 * Döner:
 *   - ürün bilgileri (foto, açıklama, stok, vb.)
 *   - bayinin atanmış fiyat listesinden gelen unit_price + tier'lar
 *   - tahmini teslim (basit kural: stokta varsa 2-3 gün, az stok 5-7 gün)
 *   - favori durumu
 *   - kategori adı
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PriceTier {
  minQuantity: number;
  discountPercent: number;
  effectiveUnitPrice: number;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;
  const { id } = await params;

  const { data: product, error } = await sb
    .from("bayi_products")
    .select(
      "id, code, name, description, base_price, unit, image_url, images, stock_quantity, low_stock_threshold, category_id, brand, barcode, min_order, weight, is_active, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[bayi:katalog:get]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!product) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Dealer + visibility
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  if (dealerId) {
    const { data: vis } = await sb
      .from("bayi_product_visibility")
      .select("visible")
      .eq("tenant_id", tenantId)
      .eq("dealer_id", dealerId)
      .eq("product_id", id)
      .maybeSingle();
    if (vis && vis.visible === false) {
      return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    }
  }

  // Kategori adı
  let categoryName: string | null = null;
  if (product.category_id) {
    const { data: cat } = await sb
      .from("bayi_categories")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", product.category_id)
      .maybeSingle();
    categoryName = (cat?.name as string) || null;
  }

  // Bayinin atanmış fiyat listesinden uygun item ve tier'lar (varsa)
  // resolveDealerPrice ile aynı pattern. Liste fiyatı + tier dizisi.
  const today = new Date().toISOString().slice(0, 10);
  const basePrice = Number(product.base_price ?? 0);
  let listUnitPrice: number = basePrice;
  let listSource: "price_list" | "base_price" = "base_price";
  let priceListId: string | null = null;
  let priceListName: string | null = null;
  let tiers: PriceTier[] = [];

  if (dealerId) {
    const { data: assigns } = await sb
      .from("bayi_dealer_price_assignments")
      .select(
        "price_list_id, priority, bayi_price_lists(id, name, is_active, valid_from, valid_until, currency)",
      )
      .eq("tenant_id", tenantId)
      .eq("dealer_id", dealerId)
      .order("priority", { ascending: true });

    interface ListLite {
      id: string;
      name: string;
      is_active: boolean;
      valid_from: string | null;
      valid_until: string | null;
      currency: string;
    }
    const eligibleLists: ListLite[] = [];
    for (const a of assigns ?? []) {
      const raw = a.bayi_price_lists as unknown;
      const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const pl = (arr[0] ?? null) as ListLite | null;
      if (!pl || !pl.is_active) continue;
      if (pl.valid_from && pl.valid_from > today) continue;
      if (pl.valid_until && pl.valid_until < today) continue;
      eligibleLists.push(pl);
    }

    for (const list of eligibleLists) {
      const { data: item } = await sb
        .from("bayi_price_list_items")
        .select("id, unit_price")
        .eq("tenant_id", tenantId)
        .eq("price_list_id", list.id)
        .eq("product_id", id)
        .maybeSingle();
      if (!item) continue;

      listUnitPrice = Number(item.unit_price);
      listSource = "price_list";
      priceListId = list.id;
      priceListName = list.name;

      const { data: tierRows } = await sb
        .from("bayi_price_tiers")
        .select("min_quantity, discount_percent")
        .eq("tenant_id", tenantId)
        .eq("price_list_item_id", item.id)
        .order("min_quantity", { ascending: true });
      tiers = (tierRows ?? []).map((t) => {
        const pct = Number(t.discount_percent);
        return {
          minQuantity: Number(t.min_quantity),
          discountPercent: pct,
          effectiveUnitPrice: +(listUnitPrice * (1 - pct / 100)).toFixed(2),
        };
      });
      break;
    }
  }

  // Favori durumu
  const { data: fav } = await sb
    .from("bayi_favorites")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("product_id", id)
    .maybeSingle();
  const isFavorite = !!fav;

  // Tahmini teslim — basit kural
  const stock = Number(product.stock_quantity ?? 0);
  const threshold = product.low_stock_threshold != null ? Number(product.low_stock_threshold) : null;
  let estimatedDelivery = "Teslim süresi belirsiz";
  if (stock <= 0) {
    estimatedDelivery = "Stokta yok — talep oluştur";
  } else if (threshold && stock < threshold) {
    estimatedDelivery = "5-7 iş günü (az stok)";
  } else {
    estimatedDelivery = "2-3 iş günü";
  }

  return NextResponse.json({
    success: true,
    product: {
      id: product.id as string,
      code: (product.code as string) || "",
      name: (product.name as string) || "",
      description: (product.description as string) || null,
      basePrice,
      unit: (product.unit as string) || "adet",
      imageUrl: (product.image_url as string) || null,
      images: (product.images as unknown as string[]) || [],
      stockQuantity: stock,
      lowStockThreshold: threshold,
      categoryId: (product.category_id as string) || null,
      categoryName,
      brand: (product.brand as string) || null,
      barcode: (product.barcode as string) || null,
      minOrder: Number(product.min_order ?? 1),
      weight: product.weight != null ? Number(product.weight) : null,
      isFavorite,
      estimatedDelivery,
    },
    pricing: {
      basePrice,
      listUnitPrice,
      source: listSource,
      priceListId,
      priceListName,
      tiers,
      currency: "TRY",
    },
  });
}
