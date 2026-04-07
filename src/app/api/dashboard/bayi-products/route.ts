import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

// GET — list products for user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: products } = await supabase
      .from("bayi_products")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("user_id", userId)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    const { data: categories } = await supabase
      .from("bayi_categories")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    return NextResponse.json({ products: products || [], categories: categories || [] });
  } catch (err) {
    console.error("[bayi-products GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — create or update product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, product } = body;
    if (!userId || !product) return NextResponse.json({ error: "userId and product required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (product.id) {
      // Update
      const { error } = await supabase
        .from("bayi_products")
        .update({
          name: product.name,
          description: product.description,
          base_price: product.base_price,
          unit_price: product.unit_price || product.base_price,
          stock_quantity: product.stock_quantity,
          low_stock_threshold: product.low_stock_threshold,
          category: product.category,
          category_id: product.category_id,
          sku: product.sku,
          barcode: product.barcode,
          unit: product.unit,
          min_order: product.min_order,
          brand: product.brand,
          weight: product.weight,
          specs: product.specs,
          images: product.images,
          image_url: product.image_url,
          is_active: product.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("user_id", userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: "updated" });
    } else {
      // Create
      const { data, error } = await supabase
        .from("bayi_products")
        .insert({
          tenant_id: profile.tenant_id,
          user_id: userId,
          name: product.name,
          description: product.description,
          base_price: product.base_price,
          unit_price: product.unit_price || product.base_price,
          stock_quantity: product.stock_quantity || 0,
          low_stock_threshold: product.low_stock_threshold || 10,
          category: product.category,
          category_id: product.category_id,
          sku: product.sku,
          barcode: product.barcode,
          unit: product.unit || "adet",
          min_order: product.min_order || 1,
          brand: product.brand,
          weight: product.weight,
          specs: product.specs || {},
          images: product.images || [],
          image_url: product.image_url,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: "created", id: data?.id });
    }
  } catch (err) {
    console.error("[bayi-products POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — delete product
export async function DELETE(req: NextRequest) {
  try {
    const { userId, productId } = await req.json();
    if (!userId || !productId) return NextResponse.json({ error: "userId and productId required" }, { status: 400 });

    const supabase = getServiceClient();
    await supabase.from("bayi_products").delete().eq("id", productId).eq("user_id", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[bayi-products DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
