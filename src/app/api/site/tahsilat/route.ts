/**
 * /api/site/tahsilat — Modül 1: Tahsilat (Sprint 2).
 *
 * GET   → Tahsilat geçmişi (sy_income_expenses type='income' category='aidat')
 *         Period filter opsiyonel.
 * POST  → Yeni tahsilat:
 *   1) MockSitePosProvider.charge() — demo, her zaman başarılı
 *   2) sy_dues_ledger satırı UPDATE: paid_amount += amount, is_paid hesapla
 *   3) sy_income_expenses INSERT: type='income', category='aidat', amount_kurus
 *
 * Body: { dues_ledger_id: uuid, amount_kurus: number, card_holder?: string,
 *         card_number_masked?: string }
 *
 * Atomic'lik: tek tablo değil (3 işlem) — production'da DB transaction
 * wrapper olmadığı için sıralı çağrı. V2'de PostgreSQL function ile atomic.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getSitePosProvider } from "@/platform/payments/site-pos";

export const dynamic = "force-dynamic";


async function resolveAdminBuilding(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: "Oturum bulunamadı.", status: 401 } as const;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status } as const;

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return { error: "Yönettiğiniz bir bina bulunamadı.", status: 403 } as const;
  }
  return { sb, userId: lookup.profile.id, buildingId: building.id, buildingName: building.name || "Apartman" } as const;
}

interface IncomeRow {
  id: string;
  period: string;
  description: string;
  amount_kurus: number;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const period = req.nextUrl.searchParams.get("period");
  let query = ctx.sb
    .from("sy_income_expenses")
    .select("id, period, description, amount_kurus, created_at")
    .eq("building_id", ctx.buildingId)
    .eq("type", "income")
    .eq("category", "aidat")
    .order("created_at", { ascending: false });

  if (period) query = query.eq("period", period);

  const { data, error } = await query;

  if (error) {
    console.error("[site/tahsilat GET] error:", error);
    return NextResponse.json({ error: "Geçmiş alınamadı." }, { status: 500 });
  }

  const rows = (data || []) as IncomeRow[];
  const total_kurus = rows.reduce((s, r) => s + (r.amount_kurus || 0), 0);

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    payments: rows,
    total_kurus,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const dues_ledger_id = String(body.dues_ledger_id || "");
  const amount_kurus = typeof body.amount_kurus === "number" ? body.amount_kurus : 0;
  if (!dues_ledger_id || amount_kurus <= 0) {
    return NextResponse.json({ error: "dues_ledger_id ve pozitif amount_kurus gerekli." }, { status: 400 });
  }

  // Hedef ledger satırını al + bina match doğrula
  const { data: ledger } = await ctx.sb
    .from("sy_dues_ledger")
    .select("id, building_id, unit_id, period, amount, paid_amount, late_charge_kurus, is_paid")
    .eq("id", dues_ledger_id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!ledger) {
    return NextResponse.json({ error: "Aidat satırı bulunamadı." }, { status: 404 });
  }

  if (ledger.is_paid) {
    return NextResponse.json({ error: "Bu aidat zaten ödenmiş." }, { status: 409 });
  }

  const totalDue = (ledger.amount || 0) - (ledger.paid_amount || 0) + (ledger.late_charge_kurus || 0);
  if (amount_kurus > totalDue) {
    return NextResponse.json(
      { error: `Tutar borç toplamından fazla (${totalDue / 100} ₺ üstü).` },
      { status: 400 },
    );
  }

  // Mock POS charge
  const provider = getSitePosProvider();
  const charge = await provider.charge({
    amount_kurus,
    currency: "TRY",
    card_number_masked: String(body.card_number_masked || "**** **** **** 0000"),
    card_holder: String(body.card_holder || "DEMO ÖDEYEN"),
    reference: dues_ledger_id,
    description: `Aidat tahsilatı — ${ledger.period}`,
  });

  if (!charge.success) {
    return NextResponse.json(
      { error: charge.error_message || "Banka işlemi başarısız." },
      { status: 502 },
    );
  }

  // Ledger güncelle (sequential — V2 atomic'leştirilir)
  const newPaid = (ledger.paid_amount || 0) + amount_kurus;
  const isPaidNow = newPaid >= (ledger.amount || 0) + (ledger.late_charge_kurus || 0);

  await ctx.sb
    .from("sy_dues_ledger")
    .update({
      paid_amount: newPaid,
      is_paid: isPaidNow,
      paid_at: isPaidNow ? new Date().toISOString() : null,
    })
    .eq("id", dues_ledger_id);

  // Income entry ekle
  const { data: incomeRow } = await ctx.sb
    .from("sy_income_expenses")
    .insert({
      building_id: ctx.buildingId,
      period: ledger.period,
      type: "income",
      category: "aidat",
      description: `Aidat tahsilatı (${charge.transaction_id})`,
      amount_kurus,
    })
    .select("id")
    .single();

  return NextResponse.json({
    success: true,
    transaction_id: charge.transaction_id,
    charged_at: charge.charged_at,
    new_paid_amount_kurus: newPaid,
    is_paid: isPaidNow,
    income_id: incomeRow?.id,
    note: "DEMO — gerçek banka çekimi yapılmadı (mock provider).",
  });
}
