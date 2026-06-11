/**
 * GET /api/dagitici/urunler/[id] — ürün detay
 * PUT /api/dagitici/urunler/[id] — güncelle
 * DELETE /api/dagitici/urunler/[id] — soft delete (is_active=false)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data, error } = await sb
    .from("bayi_products")
    .select(
      "id, code, name, description, base_price, stock_quantity, low_stock_threshold, image_url, is_active, category_id, unit, barcode, brand, min_order, weight, specs, images, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[dagitici:urunler:get]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const product = {
    id: data.id as string,
    code: (data.code as string) || "",
    name: (data.name as string) || "",
    description: (data.description as string) || null,
    basePrice: Number(data.base_price ?? 0),
    stockQuantity: Number(data.stock_quantity ?? 0),
    lowStockThreshold:
      data.low_stock_threshold != null ? Number(data.low_stock_threshold) : null,
    imageUrl: (data.image_url as string) || null,
    isActive: Boolean(data.is_active),
    categoryId: (data.category_id as string) || null,
    unit: (data.unit as string) || "adet",
    barcode: (data.barcode as string) || null,
    brand: (data.brand as string) || null,
    minOrder: Number(data.min_order ?? 1),
    weight: data.weight != null ? Number(data.weight) : null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return NextResponse.json({ success: true, product });
}

interface UpdateUrunBody {
  code?: string;
  name?: string;
  description?: string | null;
  category_id?: string | null;
  unit?: string;
  barcode?: string | null;
  base_price?: number | string;
  stock_quantity?: number | string;
  low_stock_threshold?: number | string | null;
  max_stock_threshold?: number | string | null;
  min_order?: number | string;
  brand?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as UpdateUrunBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.code != null) update.code = body.code.trim();
  if (body.name != null) update.name = body.name.trim();
  if (body.description !== undefined)
    update.description = body.description?.toString().trim() || null;
  if (body.category_id !== undefined)
    update.category_id = body.category_id || null;
  if (body.unit !== undefined) update.unit = body.unit?.trim() || "adet";
  if (body.barcode !== undefined)
    update.barcode = body.barcode?.toString().trim() || null;
  if (body.base_price !== undefined)
    update.base_price =
      body.base_price === "" || body.base_price == null
        ? 0
        : Number(body.base_price);
  if (body.stock_quantity !== undefined)
    update.stock_quantity =
      body.stock_quantity === "" || body.stock_quantity == null
        ? 0
        : Number(body.stock_quantity);
  if (body.low_stock_threshold !== undefined)
    update.low_stock_threshold =
      body.low_stock_threshold == null || body.low_stock_threshold === ""
        ? null
        : Number(body.low_stock_threshold);
  // Faz 5 — Depo: max stok eşiği (fazla stok uyarısı için)
  if (body.max_stock_threshold !== undefined)
    update.max_stock_threshold =
      body.max_stock_threshold == null || body.max_stock_threshold === ""
        ? null
        : Number(body.max_stock_threshold);
  if (body.min_order !== undefined)
    update.min_order =
      body.min_order === "" || body.min_order == null
        ? 1
        : Number(body.min_order);
  if (body.brand !== undefined)
    update.brand = body.brand?.toString().trim() || null;
  if (body.image_url !== undefined)
    update.image_url = body.image_url?.toString().trim() || null;
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  const { error } = await sb
    .from("bayi_products")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:urunler:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  // Soft delete — fiyat liste item'larında referans olabilir, hard delete
  // riskli.
  const { error } = await sb
    .from("bayi_products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:urunler:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
