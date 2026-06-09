/**
 * GET /api/dagitici/urunler — ürün listesi (filtre + sayfalama).
 *   query: q, category_id, status (active/inactive/all), page, pageSize
 *
 * POST /api/dagitici/urunler — yeni ürün.
 *   body: { code, name, description?, category_id?, unit?, barcode?,
 *           base_price?, stock_quantity?, low_stock_threshold?,
 *           min_order?, brand?, image_url? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const categoryId = url.searchParams.get("category_id") || "";
  const statusParam = url.searchParams.get("status") || "active";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSizeRaw = parseInt(
    url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`,
    10,
  );
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSizeRaw));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("bayi_products")
    .select(
      "id, code, name, description, base_price, stock_quantity, low_stock_threshold, image_url, is_active, category_id, unit, barcode, brand, min_order, updated_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId);

  if (q) {
    const safe = q.replace(/[,()]/g, "");
    query = query.or(
      `code.ilike.%${safe}%,name.ilike.%${safe}%,barcode.ilike.%${safe}%,brand.ilike.%${safe}%`,
    );
  }
  if (categoryId) query = query.eq("category_id", categoryId);
  if (statusParam === "active") query = query.eq("is_active", true);
  else if (statusParam === "inactive") query = query.eq("is_active", false);

  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[dagitici:urunler:list]", error);
    return NextResponse.json({ error: "Liste yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((p) => ({
    id: p.id as string,
    code: (p.code as string) || "",
    name: (p.name as string) || "",
    description: (p.description as string) || null,
    basePrice: Number(p.base_price ?? 0),
    stockQuantity: Number(p.stock_quantity ?? 0),
    lowStockThreshold: p.low_stock_threshold != null ? Number(p.low_stock_threshold) : null,
    imageUrl: (p.image_url as string) || null,
    isActive: Boolean(p.is_active),
    categoryId: (p.category_id as string) || null,
    unit: (p.unit as string) || "adet",
    barcode: (p.barcode as string) || null,
    brand: (p.brand as string) || null,
    minOrder: Number(p.min_order ?? 1),
    updatedAt: p.updated_at as string,
  }));

  return NextResponse.json({
    success: true,
    items,
    total: count ?? items.length,
    page,
    pageSize,
  });
}

interface NewUrunBody {
  code?: string;
  name?: string;
  description?: string;
  category_id?: string;
  unit?: string;
  barcode?: string;
  base_price?: number | string;
  stock_quantity?: number | string;
  low_stock_threshold?: number | string;
  min_order?: number | string;
  brand?: string;
  image_url?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewUrunBody;
  const code = (body.code || "").trim();
  const name = (body.name || "").trim();
  if (!code || !name) {
    return NextResponse.json({ error: "Kod ve isim zorunlu." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    user_id: userId,
    code,
    name,
    description: body.description?.trim() || null,
    category_id: body.category_id || null,
    unit: body.unit?.trim() || "adet",
    barcode: body.barcode?.trim() || null,
    base_price:
      body.base_price != null && body.base_price !== ""
        ? Number(body.base_price)
        : 0,
    stock_quantity:
      body.stock_quantity != null && body.stock_quantity !== ""
        ? Number(body.stock_quantity)
        : 0,
    low_stock_threshold:
      body.low_stock_threshold != null && body.low_stock_threshold !== ""
        ? Number(body.low_stock_threshold)
        : 10,
    min_order:
      body.min_order != null && body.min_order !== ""
        ? Number(body.min_order)
        : 1,
    brand: body.brand?.trim() || null,
    image_url: body.image_url?.trim() || null,
    is_active: true,
  };

  const { data, error } = await sb
    .from("bayi_products")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:urunler:create]", error);
    const msg = error.message?.includes("duplicate")
      ? "Bu kod ile başka ürün mevcut."
      : "Ürün kaydedilemedi.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data!.id });
}
