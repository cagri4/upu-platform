/**
 * GET /api/urunler/list — paginated ürün katalog.
 *
 * Query params:
 *   t          — magic link token
 *   page       — 1-based (default 1)
 *   pageSize   — 12/24/48 (default 24, grid kart layout)
 *   q          — name/code/brand arama (case-insensitive)
 *   category   — kategori filtresi (eq)
 *   stock      — tum | mevcut | kritik | tukenmis (default tum)
 *
 * bayiler/list pattern'iyle tutarlı: q varsa server-side range yapma,
 * tüm rows çek → JS-side multi-kolon filter → page/pageSize slice.
 *
 * Schema (probe ile doğrulanmış): id, tenant_id, code, name, description,
 * base_price, stock_quantity, low_stock_threshold, image_url, is_active,
 * user_id, category_id, sku, unit, unit_price, min_order, barcode,
 * specs, images, weight, brand, category
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

function clampInt(v: string | null, min: number, max: number, def: number): number {
  if (!v) return def;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{ tenant_id: string }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const tenantId = lookup.tenantId;
  const page = clampInt(sp.get("page"), 1, 10000, 1);
  const pageSize = clampInt(sp.get("pageSize"), 6, 100, 24);
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const category = (sp.get("category") || "").trim();
  const stock = sp.get("stock") || "tum";

  let query = supabase
    .from("bayi_products")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (category) query = query.eq("category", category);

  // Aramasız + filtresiz durumda server-side range
  if (!q) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order("name", { ascending: true, nullsFirst: false }).range(from, to);
  } else {
    query = query.order("name", { ascending: true, nullsFirst: false }).limit(1000);
  }

  const { data: products, count, error } = await query;
  if (error) {
    console.error("[urunler:list] query failed:", error);
    return NextResponse.json({
      error: "Liste alınamadı",
      details: error.message,
      code: error.code,
      hint: error.hint,
    }, { status: 500 });
  }

  // q varsa JS-side multi-kolon filter
  let working = products || [];
  if (q) {
    const ql = q.toLocaleLowerCase("tr");
    working = working.filter((p: Record<string, unknown>) => {
      const fields = ["name", "code", "sku", "brand", "category", "barcode", "description"];
      return fields.some(f => {
        const v = p[f];
        if (typeof v !== "string") return false;
        return v.toLocaleLowerCase("tr").includes(ql);
      });
    });
  }

  // Stock filter
  if (stock !== "tum") {
    working = working.filter((p: Record<string, unknown>) => {
      const stk = Number(p.stock_quantity) || 0;
      const low = Number(p.low_stock_threshold) || 10;
      if (stock === "tukenmis") return stk === 0;
      if (stock === "kritik") return stk > 0 && stk <= low;
      if (stock === "mevcut") return stk > low;
      return true;
    });
  }

  const rows = working.map((p: Record<string, unknown>) => {
    const stk = Number(p.stock_quantity) || 0;
    const low = Number(p.low_stock_threshold) || 10;
    let stockStatus: "out" | "critical" | "ok" = "ok";
    if (stk === 0) stockStatus = "out";
    else if (stk <= low) stockStatus = "critical";
    return {
      id: p.id as string,
      code: (p.code as string) || (p.sku as string) || "",
      name: (p.name as string) || "—",
      brand: (p.brand as string) || null,
      category: (p.category as string) || null,
      unit: (p.unit as string) || "adet",
      basePrice: Number(p.base_price) || 0,
      unitPrice: Number(p.unit_price) || Number(p.base_price) || 0,
      stockQuantity: stk,
      lowStockThreshold: low,
      stockStatus,
      imageUrl: (p.image_url as string) || null,
      barcode: (p.barcode as string) || null,
    };
  });

  // Pagination — q veya stock!=tum varsa post-filter slice
  let pageRows = rows;
  let totalForPaging: number;
  if (q || stock !== "tum") {
    totalForPaging = rows.length;
    const from = (page - 1) * pageSize;
    pageRows = rows.slice(from, from + pageSize);
  } else {
    totalForPaging = count || 0;
  }

  return NextResponse.json({
    rows: pageRows,
    total: totalForPaging,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(totalForPaging / pageSize)),
  });
}
