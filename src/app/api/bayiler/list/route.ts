/**
 * GET /api/bayiler/list — paginated bayi listesi.
 *
 * Query params:
 *   t          — magic link token (zorunlu)
 *   page       — 1-based (default 1)
 *   pageSize   — 10/20/50 (default 20)
 *   q          — isim/telefon arama (case-insensitive)
 *   status     — aktif | pasif | tum (default aktif)
 *   vade       — kritik | bekleyen | temiz | tum (default tum)
 *
 * Response:
 *   { rows: BayiRow[], total, page, pageSize, pages }
 *
 * BayiRow:
 *   id, name, contactName, contactPhone, city, country, isActive, balance,
 *   lastOrderDate, lastOrderId, criticalDays (vadesi en çok geçmiş gün, null=temiz)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

function clampInt(v: string | null, min: number, max: number, def: number): number {
  if (!v) return def;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("t") || sp.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, capabilities")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  const tenantId = profile.tenant_id;
  const page = clampInt(sp.get("page"), 1, 10000, 1);
  const pageSize = clampInt(sp.get("pageSize"), 5, 100, 20);
  const qRaw = (sp.get("q") || "").trim();
  const q = qRaw.slice(0, 100);
  const status = sp.get("status") || "aktif";
  const vade = sp.get("vade") || "tum";

  // Base query — select("*") tüm kolonlar (schema farkı agnostic).
  // Arama (q): server-side .or() filter kullanmıyoruz çünkü bayi_dealers
  // schema'sındaki name kolonu bazı bayiler için boş; başlık görünüm
  // company_name'den geliyor. PostgREST .or() filter'a verilen kolon
  // tabloda yoksa veya null ise iş kırılır → JS-side multi-kolon filter
  // (name + company_name + city + district + phone + contact_name)
  // ile schema-agnostic + eksiksiz arama. Tek dezavantaj: pagination
  // post-filter yapılır, server-side range yok. 5-1000 bayi range için
  // sorun değil; büyük tenantlarda Postgres FTS / GIN tsvector ile
  // değiştirilir.
  let query = supabase
    .from("bayi_dealers")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (status === "aktif") query = query.eq("is_active", true);
  else if (status === "pasif") query = query.eq("is_active", false);

  // Aramada server-side range YOK — JS post-filter'dan sonra slice.
  // Aramasız durumda mevcut paginated davranış korunuyor (limit/range).
  if (!q) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order("name", { ascending: true, nullsFirst: false }).range(from, to);
  } else {
    // Arama varsa max 1000 bayi çek (üst sınır), JS-side filtrele.
    query = query.order("name", { ascending: true, nullsFirst: false }).limit(1000);
  }

  const { data: dealers, count, error } = await query;
  if (error) {
    console.error("[bayiler:list] dealers query failed:", error);
    return NextResponse.json({
      error: "Liste alınamadı",
      details: error.message,
      code: error.code,
      hint: error.hint,
    }, { status: 500 });
  }

  // q varsa JS-side multi-kolon filter (case-insensitive substring).
  // Aranacak alanlar: name, company_name, city, district, phone,
  // contact_name. Hangisi null/undefined ise atlar.
  let workingDealers = dealers || [];
  if (q) {
    const ql = q.toLocaleLowerCase("tr");
    workingDealers = workingDealers.filter((d: Record<string, unknown>) => {
      const fields = ["name", "company_name", "city", "district", "phone", "contact_name", "email"];
      return fields.some(f => {
        const v = d[f];
        if (typeof v !== "string") return false;
        return v.toLocaleLowerCase("tr").includes(ql);
      });
    });
  }

  const dealerIds = workingDealers.map((d: { id: string }) => d.id);
  const safeIds = dealerIds.length ? dealerIds : ["00000000-0000-0000-0000-000000000000"];

  // Vade durumu — bayi_dealer_transactions'tan (sale type, due_date geçmiş).
  // bayi_dealer_invoices'ta due_date kolonu yok; vade tracking transactions'da.
  // Sale type ('debit' balance_effect) bayi'nin borcunu temsil eder.
  const { data: txTypes } = await supabase
    .from("bayi_transaction_types")
    .select("id, code");
  const saleTypeId = (txTypes || []).find(t => t.code === "sale")?.id;

  const { data: transactions, error: txErr } = await supabase
    .from("bayi_dealer_transactions")
    .select("dealer_id, due_date, transaction_type_id, amount")
    .in("dealer_id", safeIds);
  if (txErr) console.error("[bayiler:list] transactions query failed (devam):", txErr);

  // Son sipariş — bayi_orders
  const { data: lastOrders, error: ordErr } = await supabase
    .from("bayi_orders")
    .select("*")
    .in("dealer_id", safeIds)
    .order("created_at", { ascending: false });
  if (ordErr) console.error("[bayiler:list] orders query failed (devam):", ordErr);

  const today = new Date();
  const dealerVade = new Map<string, number | null>();
  for (const tx of (transactions || []) as Array<{ dealer_id: string; due_date: string | null; transaction_type_id: string }>) {
    if (!tx.due_date) continue;
    if (saleTypeId && tx.transaction_type_id !== saleTypeId) continue;
    const due = new Date(tx.due_date);
    const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
    const prev = dealerVade.get(tx.dealer_id) ?? null;
    if (prev === null || diff > prev) dealerVade.set(tx.dealer_id, diff);
  }

  const dealerLastOrder = new Map<string, { id: string; date: string; total: number }>();
  for (const o of (lastOrders || []) as Array<{ id: string; dealer_id: string; total_amount: number; created_at: string }>) {
    if (!dealerLastOrder.has(o.dealer_id)) {
      dealerLastOrder.set(o.dealer_id, { id: o.id, date: o.created_at, total: Number(o.total_amount) || 0 });
    }
  }

  const rows = workingDealers.map((d: Record<string, unknown>) => {
    let criticalDays = dealerVade.get(d.id as string) ?? null;
    const lastO = dealerLastOrder.get(d.id as string);
    const balance = Number(d.balance) || 0;

    // Fallback: invoice tablosu boş AMA balance > 0 ise bayi en azından
    // "borçlu" durumunda. criticalDays null ise risk_status alanına bak;
    // 'watch' veya 'blacklist' ise kritik say (7 gün eşdeğeri).
    const riskStatus = (d.risk_status as string) || "clean";
    if (criticalDays === null && balance > 0) {
      // Borçlu ama vade kaydı yok → en az "0 gün bekleyen" göster.
      criticalDays = 0;
    }
    const isCritical = (criticalDays !== null && criticalDays >= 7) || riskStatus === "watch" || riskStatus === "blacklist";

    return {
      id: d.id as string,
      name: (d.name as string) || (d.company_name as string) || "—",
      contactName: (d.contact_name as string) || null,
      contactPhone: (d.phone as string) || (d.contact_phone as string) || null,
      email: (d.email as string) || null,
      city: (d.city as string) || null,
      country: (d.country as string) || null,
      isActive: d.is_active !== false,
      balance,
      lastOrderId: lastO?.id || null,
      lastOrderDate: lastO?.date || null,
      lastOrderTotal: lastO?.total || 0,
      criticalDays,
      isCritical,
      riskStatus,
      createdAt: (d.created_at as string) || null,
    };
  });

  // Vade filtresi (post-filter — invoices ile JOIN yapmak supabase'da zor)
  let filteredRows = rows;
  if (vade === "kritik") {
    filteredRows = rows.filter(r => r.isCritical);
  } else if (vade === "bekleyen") {
    filteredRows = rows.filter(r => r.criticalDays !== null && r.criticalDays < 7 && r.criticalDays >= 0);
  } else if (vade === "temiz") {
    filteredRows = rows.filter(r => r.criticalDays === null || r.criticalDays < 0);
  }

  // Pagination — q varsa filteredRows üzerinde JS-side; q yoksa server
  // zaten range yapmış. Total da q durumuna göre değişir.
  let pageRows = filteredRows;
  let totalForPaging: number;
  if (q || vade !== "tum") {
    // Post-filter sonrası gerçek toplam = filteredRows.length
    totalForPaging = filteredRows.length;
    const from = (page - 1) * pageSize;
    pageRows = filteredRows.slice(from, from + pageSize);
  } else {
    // Server-side range zaten sayfayı kestik; count = tablo toplamı
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
