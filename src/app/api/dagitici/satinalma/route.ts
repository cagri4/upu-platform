/**
 * GET  /api/dagitici/satinalma?status=&supplier_id= — PO listesi.
 * POST /api/dagitici/satinalma — yeni satın alma siparişi (PO) + satırlar.
 *   body: { supplier_id, expected_date?, note?, lines: [{ product_id, quantity, unit_price }] }
 *
 * PO 'draft' durumunda başlar. subtotal/total satırlardan hesaplanır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";
import { MAX_STOCK_QTY, MAX_UNIT_COST } from "@/platform/bayi/warehouse";

export const dynamic = "force-dynamic";

const PO_STATUSES = ["draft", "sent", "partial", "received", "closed"];

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const supplierId = url.searchParams.get("supplier_id");

  let q = sb
    .from("bayi_purchase_orders")
    .select("id, po_number, supplier_id, status, expected_date, total_amount, created_at, bayi_suppliers(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && PO_STATUSES.includes(status)) q = q.eq("status", status);
  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) {
    console.error("[dagitici:satinalma:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };
  const todayStr = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((p) => ({
      id: p.id as string,
      poNumber: p.po_number as string,
      supplierId: p.supplier_id as string,
      supplierName: (pick(p.bayi_suppliers)?.name as string) || "Tedarikçi",
      status: p.status as string,
      expectedDate: (p.expected_date as string) || null,
      total: Number(p.total_amount ?? 0),
      overdue: ["sent", "partial"].includes(p.status as string) && !!p.expected_date && (p.expected_date as string) < todayStr,
      createdAt: p.created_at as string,
    })),
  });
}

interface POLineInput {
  product_id?: string;
  quantity?: number | string;
  unit_price?: number | string;
}
interface NewPOBody {
  supplier_id?: string;
  expected_date?: string;
  note?: string;
  lines?: POLineInput[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewPOBody;
  const supplierId = (body.supplier_id || "").trim();
  const lineInput = Array.isArray(body.lines) ? body.lines : [];
  if (!supplierId) return NextResponse.json({ error: "Tedarikçi zorunlu." }, { status: 400 });
  if (lineInput.length === 0) return NextResponse.json({ error: "En az bir satır gir." }, { status: 400 });
  if (body.expected_date && !DATE_RE.test(body.expected_date)) {
    return NextResponse.json({ error: "Geçersiz teslim tarihi." }, { status: 400 });
  }

  // Tedarikçi tenant doğrula
  const { data: sup } = await sb
    .from("bayi_suppliers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", supplierId)
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  // Ürünleri tenant'a göre doğrula
  const productIds = Array.from(new Set(lineInput.map((l) => (l.product_id || "").trim()).filter((x) => x)));
  const { data: prods } = await sb
    .from("bayi_products")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  const validProd = new Set((prods ?? []).map((p) => p.id as string));

  const lines: Array<{ product_id: string; quantity: number; unit_price: number; line_total: number }> = [];
  let subtotal = 0;
  for (const l of lineInput) {
    const pid = (l.product_id || "").trim();
    if (!validProd.has(pid)) continue;
    const qty = Math.floor(Number(l.quantity ?? 0));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ error: "Geçerli miktar gir (≥1)." }, { status: 400 });
    }
    if (qty > MAX_STOCK_QTY) {
      return NextResponse.json({ error: `Miktar çok yüksek (en fazla ${MAX_STOCK_QTY}).` }, { status: 400 });
    }
    const price = Number(l.unit_price ?? 0);
    if (!Number.isFinite(price) || price < 0 || price > MAX_UNIT_COST) {
      return NextResponse.json({ error: "Geçersiz birim fiyat." }, { status: 400 });
    }
    const lineTotal = +(qty * price).toFixed(2);
    subtotal += lineTotal;
    lines.push({ product_id: pid, quantity: qty, unit_price: +price.toFixed(2), line_total: lineTotal });
  }
  if (lines.length === 0) return NextResponse.json({ error: "Geçerli ürün satırı yok." }, { status: 400 });

  // PO number üret
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count } = await sb
    .from("bayi_purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const poNumber = `PO-${ym}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const total = +subtotal.toFixed(2);

  const { data: po, error: poErr } = await sb
    .from("bayi_purchase_orders")
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      po_number: poNumber,
      status: "draft",
      expected_date: body.expected_date || null,
      subtotal: total,
      total_amount: total,
      note: body.note?.trim() || null,
      created_by: profileId,
    })
    .select("id, po_number")
    .single();
  if (poErr || !po) {
    console.error("[dagitici:satinalma:create]", poErr);
    return NextResponse.json({ error: "PO oluşturulamadı." }, { status: 400 });
  }
  const poId = po.id as string;

  const { error: linesErr } = await sb.from("bayi_purchase_order_lines").insert(
    lines.map((l) => ({
      tenant_id: tenantId,
      po_id: poId,
      product_id: l.product_id,
      quantity: l.quantity,
      received_qty: 0,
      unit_price: l.unit_price,
      line_total: l.line_total,
    })),
  );
  if (linesErr) {
    console.error("[dagitici:satinalma:lines]", linesErr);
    return NextResponse.json({ error: "Satırlar kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: poId, poNumber: po.po_number as string, total });
}
