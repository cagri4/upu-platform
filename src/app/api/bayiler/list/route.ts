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
  const q = (sp.get("q") || "").trim();
  const status = sp.get("status") || "aktif";
  const vade = sp.get("vade") || "tum";

  // Base query — name + company_name iki kolon da select (legacy + yeni seed)
  let query = supabase
    .from("bayi_dealers")
    .select("id, name, company_name, contact_name, contact_phone, phone, email, city, country, is_active, balance, created_at", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (status === "aktif") query = query.eq("is_active", true);
  else if (status === "pasif") query = query.eq("is_active", false);
  // status === "tum" → filtre yok

  if (q) {
    // ilike OR — name veya company_name veya contact_phone'a sığar
    query = query.or(
      `name.ilike.%${q}%,company_name.ilike.%${q}%,contact_phone.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order("name", { ascending: true, nullsFirst: false }).range(from, to);

  const { data: dealers, count, error } = await query;
  if (error) {
    console.error("[bayiler:list]", error);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }

  const dealerIds = (dealers || []).map(d => d.id);

  // Vade durumu — bayi_dealer_invoices'tan en geç vade
  const { data: invoices } = await supabase
    .from("bayi_dealer_invoices")
    .select("dealer_id, due_date, is_paid, amount")
    .in("dealer_id", dealerIds.length ? dealerIds : ["00000000-0000-0000-0000-000000000000"]);

  // Son sipariş — bayi_orders
  const { data: lastOrders } = await supabase
    .from("bayi_orders")
    .select("id, dealer_id, total_amount, status, created_at")
    .in("dealer_id", dealerIds.length ? dealerIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const today = new Date();
  const dealerVade = new Map<string, number | null>(); // dealer_id → criticalDays (null=temiz)
  for (const inv of invoices || []) {
    if (inv.is_paid) continue;
    const due = new Date(inv.due_date);
    const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
    // pozitif = geç kalmış
    const prev = dealerVade.get(inv.dealer_id) ?? null;
    if (prev === null || diff > prev) dealerVade.set(inv.dealer_id, diff);
  }

  const dealerLastOrder = new Map<string, { id: string; date: string; total: number }>();
  for (const o of lastOrders || []) {
    if (!dealerLastOrder.has(o.dealer_id)) {
      dealerLastOrder.set(o.dealer_id, { id: o.id, date: o.created_at, total: o.total_amount || 0 });
    }
  }

  const rows = (dealers || []).map(d => {
    const criticalDays = dealerVade.get(d.id) ?? null;
    const lastO = dealerLastOrder.get(d.id);
    return {
      id: d.id,
      name: d.name || d.company_name || "—",
      contactName: d.contact_name || null,
      contactPhone: d.contact_phone || d.phone || null,
      email: d.email || null,
      city: d.city || null,
      country: d.country || null,
      isActive: d.is_active !== false,
      balance: d.balance || 0,
      lastOrderId: lastO?.id || null,
      lastOrderDate: lastO?.date || null,
      lastOrderTotal: lastO?.total || 0,
      criticalDays,                 // pozitif = geç kalmış gün
      isCritical: criticalDays !== null && criticalDays >= 7,
      createdAt: d.created_at,
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

  return NextResponse.json({
    rows: filteredRows,
    total: count || 0,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil((count || 0) / pageSize)),
  });
}
