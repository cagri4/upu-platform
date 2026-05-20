/**
 * POST /api/bayi-urun-import/save — toplu ürün insert (CSV/Excel parse
 * client'ta yapılır, server sadece doğrulanmış row dizisi alır).
 *
 * Body: { token, rows: Array<{ name, category?, brand?, base_price, stock_quantity?, unit?, sku?, barcode?, description?, min_order?, weight?, image_url? }> }
 *
 * 1000+ satır için 200'er chunk halinde insert eder. Validation:
 *   - name zorunlu (min 2 karakter)
 *   - base_price > 0 zorunlu
 *   - SKU benzersizlik check (mevcut ürünlerle çakışırsa hata listesine ekler)
 *
 * Response: { success, inserted, errors: [{ row, reason }], chunks }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHUNK_SIZE = 200;

interface ImportRow {
  name?: string;
  category?: string;
  brand?: string;
  base_price?: number;
  unit_price?: number;
  stock_quantity?: number;
  unit?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  min_order?: number;
  weight?: number;
  image_url?: string;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  let body: { token?: string; rows?: ImportRow[] };
  try {
    body = await req.json() as { token?: string; rows?: ImportRow[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "Satır yok" }, { status: 400 });
  if (rows.length > 5000) {
    return NextResponse.json({ error: "Tek seferde en fazla 5000 satır yüklenir." }, { status: 413 });
  }

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; capabilities: string[] | null; invited_by: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, capabilities, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const caps = (profile.capabilities as string[] | null) || [];
  if (!caps.includes("*") && !caps.includes("products:edit")) {
    return NextResponse.json({ error: "Toplu ürün yükleme yetkiniz yok." }, { status: 403 });
  }

  const ownerId = profile.invited_by || profile.id;
  const tenantId = profile.tenant_id;

  // Mevcut SKU'ları çek (yeni satır SKU'ları çakışırsa hata listesine ekleriz)
  const { data: existingProducts } = await supabase
    .from("bayi_products")
    .select("sku")
    .eq("tenant_id", tenantId)
    .not("sku", "is", null);
  const existingSkus = new Set((existingProducts || []).map(p => String(p.sku).trim().toLowerCase()).filter(Boolean));

  // Validate + normalize
  const validRows: Record<string, unknown>[] = [];
  const errors: { row: number; reason: string }[] = [];
  const seenSkus = new Set<string>();

  rows.forEach((r, idx) => {
    const rowNo = idx + 2; // +2: 1 = header, 0-based offset
    const name = String(r.name || "").trim();
    if (name.length < 2) {
      errors.push({ row: rowNo, reason: "Ürün adı eksik veya 2 karakterden kısa" });
      return;
    }
    const basePrice = num(r.base_price);
    if (basePrice === null || basePrice <= 0) {
      errors.push({ row: rowNo, reason: "Fiyat geçersiz veya sıfır" });
      return;
    }
    const sku = String(r.sku || "").trim();
    if (sku) {
      const lowSku = sku.toLowerCase();
      if (existingSkus.has(lowSku)) {
        errors.push({ row: rowNo, reason: `SKU "${sku}" zaten mevcut` });
        return;
      }
      if (seenSkus.has(lowSku)) {
        errors.push({ row: rowNo, reason: `SKU "${sku}" dosyada tekrarlanıyor` });
        return;
      }
      seenSkus.add(lowSku);
    }

    validRows.push({
      tenant_id: tenantId,
      user_id: ownerId,
      name,
      category: String(r.category || "").trim() || null,
      brand: String(r.brand || "").trim() || null,
      base_price: basePrice,
      unit_price: num(r.unit_price) ?? basePrice,
      stock_quantity: num(r.stock_quantity) ?? 0,
      unit: String(r.unit || "adet").trim(),
      sku: sku || null,
      barcode: String(r.barcode || "").trim() || null,
      description: String(r.description || "").trim() || null,
      min_order: num(r.min_order) ?? 1,
      weight: num(r.weight) ?? 0,
      image_url: String(r.image_url || "").trim() || null,
      is_active: true,
    });
  });

  // Chunked insert
  let inserted = 0;
  const chunks: number[] = [];
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const { error: insErr, count } = await supabase
      .from("bayi_products")
      .insert(chunk, { count: "exact" });
    if (insErr) {
      errors.push({ row: i + 2, reason: `Chunk ${i / CHUNK_SIZE + 1} insert hatası: ${insErr.message}` });
    } else {
      inserted += count ?? chunk.length;
      chunks.push(chunk.length);
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    errors,
    chunks: chunks.length,
    totalRows: rows.length,
  });
}
