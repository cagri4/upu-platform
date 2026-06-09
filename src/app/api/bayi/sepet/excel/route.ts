/**
 * POST /api/bayi/sepet/excel — Excel ile toplu sepet ekleme.
 *
 * Beklenen sütun başlıkları (1. satır): kod, miktar  (veya "code" / "quantity")
 *
 * dryRun=true → sadece eşleşmeleri rapor et (sepete eklemeden)
 * dryRun=false → eşleşen kodları sepete ekle (var olan satırlarda quantity toplanır)
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../_auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RowResult {
  row: number;
  code: string | null;
  ok: boolean;
  productId?: string;
  productName?: string;
  quantity?: number;
  error?: string;
}

const CODE_HEADERS = ["kod", "code", "sku", "ürün kodu", "urun kodu"];
const QTY_HEADERS = ["miktar", "adet", "quantity", "qty"];

function normalize(h: string): string {
  return h.toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form okunamadı." }, { status: 400 });
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
    await (workbook.xlsx as unknown as { load: (b: ArrayBuffer) => Promise<unknown> }).load(arrayBuffer);
  } catch {
    return NextResponse.json({ error: "Excel okunamadı." }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "Sayfa yok." }, { status: 400 });

  const headerCells = (sheet.getRow(1).values as (string | undefined)[]).slice(1);
  const headers = headerCells.map((c) => (c == null ? "" : c.toString()));
  let codeIdx = -1;
  let qtyIdx = -1;
  headers.forEach((h, i) => {
    const n = normalize(h);
    if (CODE_HEADERS.includes(n)) codeIdx = i;
    if (QTY_HEADERS.includes(n)) qtyIdx = i;
  });
  if (codeIdx < 0 || qtyIdx < 0) {
    return NextResponse.json(
      {
        error:
          "Zorunlu sütun eksik: 'kod' ve 'miktar' başlıklarına sahip kolonlar olmalı.",
        detectedHeaders: headers,
      },
      { status: 400 },
    );
  }

  const lastRow = sheet.actualRowCount;
  const MAX_ROWS = 500;
  const limit = Math.min(lastRow, MAX_ROWS + 1);

  // Önce tüm kodları topla
  const wanted: Array<{ row: number; code: string; quantity: number }> = [];
  for (let r = 2; r <= limit; r++) {
    const row = sheet.getRow(r);
    const cells = (row.values as unknown[]).slice(1);
    if (cells.every((c) => c == null || c === "")) continue;
    const rawCode = cells[codeIdx];
    const rawQty = cells[qtyIdx];
    const code = rawCode == null ? "" : rawCode.toString().trim();
    const quantity = Math.floor(Number(rawQty ?? 0));
    if (!code) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    wanted.push({ row: r, code, quantity });
  }

  if (wanted.length === 0) {
    return NextResponse.json({
      success: true,
      summary: { total: 0, ok: 0, error: 0, added: 0 },
      results: [],
    });
  }

  const codes = Array.from(new Set(wanted.map((w) => w.code)));
  const { data: prods } = await sb
    .from("bayi_products")
    .select("id, code, name, base_price, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("code", codes);
  type ProdRow = { id: string; code: string; name: string; base_price: number };
  const prodByCode = new Map<string, ProdRow>();
  ((prods ?? []) as ProdRow[]).forEach((p) => prodByCode.set(p.code, p));

  const results: RowResult[] = wanted.map((w) => {
    const p = prodByCode.get(w.code);
    if (!p) return { row: w.row, code: w.code, ok: false, error: "Ürün bulunamadı" };
    return {
      row: w.row,
      code: w.code,
      ok: true,
      productId: p.id,
      productName: p.name,
      quantity: w.quantity,
    };
  });

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      summary: {
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        error: results.filter((r) => !r.ok).length,
      },
      results,
    });
  }

  // Commit — açık sepete merge
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  let cartId: string;
  const { data: cart } = await sb
    .from("bayi_carts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (cart) {
    cartId = cart.id as string;
  } else {
    const { data: created } = await sb
      .from("bayi_carts")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        dealer_id: dealerId,
        status: "open",
      })
      .select("id")
      .single();
    if (!created) {
      return NextResponse.json({ error: "Sepet oluşturulamadı." }, { status: 500 });
    }
    cartId = created.id as string;
  }

  let added = 0;
  for (const r of results) {
    if (!r.ok || !r.productId || !r.quantity) continue;
    const prod = prodByCode.get(r.code || "")!;
    const { data: existing } = await sb
      .from("bayi_cart_items")
      .select("id, quantity")
      .eq("tenant_id", tenantId)
      .eq("cart_id", cartId)
      .eq("product_id", r.productId)
      .maybeSingle();
    if (existing) {
      await sb
        .from("bayi_cart_items")
        .update({ quantity: Number(existing.quantity) + r.quantity })
        .eq("tenant_id", tenantId)
        .eq("id", existing.id);
    } else {
      await sb.from("bayi_cart_items").insert({
        tenant_id: tenantId,
        cart_id: cartId,
        product_id: r.productId,
        quantity: r.quantity,
        unit_price: prod.base_price ?? 0,
      });
    }
    added += 1;
  }

  await sb
    .from("bayi_carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", cartId);

  return NextResponse.json({
    success: true,
    dryRun: false,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      error: results.filter((r) => !r.ok).length,
      added,
    },
    cartId,
    results,
  });
}
