import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

/**
 * POST — CSV bulk import for products
 *
 * Expected CSV format (first row = header):
 * ad,kategori,fiyat,stok,birim,marka,sku,barkod,aciklama,min_siparis,agirlik
 *
 * Minimum required: ad, fiyat
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, csvData } = body;
    if (!userId || !csvData) return NextResponse.json({ error: "userId and csvData required" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Parse CSV
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) return NextResponse.json({ error: "CSV en az 2 satir olmali (baslik + veri)" }, { status: 400 });

    const headerLine = lines[0].toLowerCase().trim();
    const headers = headerLine.split(/[,;\t]/).map((h: string) => h.trim().replace(/"/g, ""));

    // Map header names to DB fields
    const fieldMap: Record<string, string> = {
      "ad": "name", "urun": "name", "urun_adi": "name", "name": "name", "ürün": "name", "ürün adı": "name",
      "kategori": "category", "category": "category", "grup": "category",
      "fiyat": "base_price", "price": "base_price", "birim_fiyat": "base_price",
      "stok": "stock_quantity", "stock": "stock_quantity", "miktar": "stock_quantity",
      "birim": "unit", "unit": "unit",
      "marka": "brand", "brand": "brand",
      "sku": "sku", "kod": "sku", "urun_kodu": "sku",
      "barkod": "barcode", "barcode": "barcode",
      "aciklama": "description", "description": "description", "açıklama": "description",
      "min_siparis": "min_order", "min_order": "min_order",
      "agirlik": "weight", "weight": "weight", "ağırlık": "weight",
      "gorsel": "image_url", "image": "image_url", "resim": "image_url", "görsel": "image_url",
    };

    const columnMap: Record<number, string> = {};
    headers.forEach((h: string, i: number) => {
      const field = fieldMap[h];
      if (field) columnMap[i] = field;
    });

    if (!Object.values(columnMap).includes("name")) {
      return NextResponse.json({ error: "CSV'de 'ad' veya 'urun' sutunu bulunamadi" }, { status: 400 });
    }

    // Parse data rows
    const products: Record<string, unknown>[] = [];
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(/[,;\t]/).map((v: string) => v.trim().replace(/^"|"$/g, ""));
      const product: Record<string, unknown> = {
        tenant_id: profile.tenant_id,
        user_id: userId,
        is_active: true,
        unit: "adet",
        min_order: 1,
        low_stock_threshold: 10,
        stock_quantity: 0,
      };

      for (const [colIdx, field] of Object.entries(columnMap)) {
        const val = values[Number(colIdx)];
        if (!val) continue;

        if (field === "base_price" || field === "weight") {
          const num = parseFloat(val.replace(/[^\d.,]/g, "").replace(",", "."));
          if (!isNaN(num)) {
            product[field] = num;
            if (field === "base_price") product.unit_price = num;
          }
        } else if (field === "stock_quantity" || field === "min_order") {
          const num = parseInt(val.replace(/[^\d]/g, ""), 10);
          if (!isNaN(num)) product[field] = num;
        } else {
          product[field] = val;
        }
      }

      if (product.name && (product.name as string).length > 0) {
        products.push(product);
      } else {
        errors++;
      }
    }

    if (products.length === 0) {
      return NextResponse.json({ error: "Gecerli urun bulunamadi", errors }, { status: 400 });
    }

    // Bulk insert
    const { error: insertErr } = await supabase.from("bayi_products").insert(products);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imported: products.length,
      errors,
      total: lines.length - 1,
    });
  } catch (err) {
    console.error("[bayi-products/csv]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
