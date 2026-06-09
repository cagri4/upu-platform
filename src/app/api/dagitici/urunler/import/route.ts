/**
 * POST /api/dagitici/urunler/import — Excel toplu ürün import.
 *
 * Multipart upload (file + dryRun flag).
 * Beklenen sütun başlıkları (1. satır): kod, isim, açıklama, kategori,
 * birim, barkod, base_price, stok, min_stok, min_siparis, marka
 *
 * Dry-run: insert yok; hata sayımı + örnek + satır numaraları döner.
 * Commit: dryRun=false → insert/upsert (code+tenant key) yapılır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RowResult {
  row: number;
  ok: boolean;
  error?: string;
  code?: string;
  name?: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["kod", "code", "sku", "ürün kodu"],
  name: ["isim", "ad", "name", "ürün adı"],
  description: ["açıklama", "description", "desc"],
  category: ["kategori", "category"],
  unit: ["birim", "unit"],
  barcode: ["barkod", "barcode"],
  base_price: ["base_price", "fiyat", "varsayilan fiyat", "varsayılan fiyat", "price"],
  stock_quantity: ["stok", "stock", "stock_quantity"],
  low_stock_threshold: ["min_stok", "low_stock", "düşük stok"],
  min_order: ["min_siparis", "min_sipariş", "min_order"],
  brand: ["marka", "brand"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim();
}

function mapHeaders(headerRow: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => a.toLowerCase() === norm)) {
        out[field] = idx;
        break;
      }
    }
  });
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form verisi okunamadı." }, { status: 400 });
  }

  const file = formData.get("file");
  const dryRun = (formData.get("dryRun") || "true").toString() === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya gerekli (xlsx)." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Dosya 5MB üstü." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs.d.ts Buffer tipini istiyor; Node 22+ Buffer<ArrayBufferLike>
    // generic'i ile uyumsuz görünüyor. Runtime'da xlsx.load arrayBuffer'ı
    // direkt yer.
    await (workbook.xlsx as unknown as { load: (b: ArrayBuffer) => Promise<unknown> }).load(arrayBuffer);
  } catch {
    return NextResponse.json({ error: "Excel dosyası açılamadı." }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "Dosyada sayfa yok." }, { status: 400 });
  }

  // 1. satır = header
  const headerCells = (sheet.getRow(1).values as (string | undefined)[]).slice(1);
  const headers = headerCells.map((c) => (c == null ? "" : c.toString()));
  const headerMap = mapHeaders(headers);

  if (headerMap.code === undefined || headerMap.name === undefined) {
    return NextResponse.json(
      {
        error: "Zorunlu sütun eksik: 'kod' ve 'isim' başlıklı kolonlar olmalı.",
        detectedHeaders: headers,
      },
      { status: 400 },
    );
  }

  // Kategori ad → id cache
  const categoryMap = new Map<string, string>();
  if (headerMap.category !== undefined) {
    const { data: cats } = await sb
      .from("bayi_categories")
      .select("id, name")
      .eq("tenant_id", tenantId);
    (cats ?? []).forEach((c) => {
      const key = ((c.name as string) || "").toLowerCase().trim();
      if (key) categoryMap.set(key, c.id as string);
    });
  }

  const results: RowResult[] = [];
  const inserts: Record<string, unknown>[] = [];
  const lastRow = sheet.actualRowCount;
  const MAX_ROWS = 1000;
  const limit = Math.min(lastRow, MAX_ROWS + 1);

  for (let r = 2; r <= limit; r++) {
    const row = sheet.getRow(r);
    const cells = (row.values as (unknown)[]).slice(1);
    if (cells.every((c) => c == null || c === "")) continue;

    const get = (field: string): string | null => {
      const idx = headerMap[field];
      if (idx === undefined) return null;
      const v = cells[idx];
      if (v == null) return null;
      if (typeof v === "object" && v !== null && "text" in v) {
        return ((v as { text: string }).text ?? "").toString();
      }
      return v.toString();
    };

    const code = get("code")?.trim() || "";
    const name = get("name")?.trim() || "";
    if (!code || !name) {
      results.push({ row: r, ok: false, error: "kod veya isim boş" });
      continue;
    }

    let categoryId: string | null = null;
    const catText = get("category")?.trim().toLowerCase();
    if (catText) {
      categoryId = categoryMap.get(catText) || null;
    }

    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      user_id: userId,
      code,
      name,
      description: get("description")?.trim() || null,
      category_id: categoryId,
      unit: get("unit")?.trim() || "adet",
      barcode: get("barcode")?.trim() || null,
      base_price: Number(get("base_price") || 0) || 0,
      stock_quantity: Number(get("stock_quantity") || 0) || 0,
      low_stock_threshold: Number(get("low_stock_threshold") || 10) || 10,
      min_order: Number(get("min_order") || 1) || 1,
      brand: get("brand")?.trim() || null,
      is_active: true,
    };

    inserts.push(payload);
    results.push({ row: r, ok: true, code, name });
  }

  const summary = {
    total: results.length,
    ok: results.filter((x) => x.ok).length,
    error: results.filter((x) => !x.ok).length,
    rowsExceeded: lastRow > MAX_ROWS + 1,
  };

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      summary,
      sample: results.slice(0, 20),
    });
  }

  // Commit — chunk'lar halinde insert (Supabase batch limit ~1000)
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { error } = await sb.from("bayi_products").insert(chunk);
    if (error) {
      console.error("[dagitici:urunler:import]", error);
      return NextResponse.json(
        {
          error: "Bir kısmı yüklenirken hata: " + error.message,
          inserted,
        },
        { status: 500 },
      );
    }
    inserted += chunk.length;
  }

  return NextResponse.json({
    success: true,
    dryRun: false,
    summary: { ...summary, inserted },
  });
}
