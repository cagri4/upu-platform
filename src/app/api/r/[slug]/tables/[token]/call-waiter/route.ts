/**
 * POST /api/r/[slug]/tables/[token]/call-waiter
 *
 * QR'dan masada oturan müşteri garson çağırır veya hesap ister.
 *
 * Body: { reason: 'call' | 'bill_request' | 'complaint' | 'other', notes?: string }
 *
 * Rate limit (D6 detayı): 1 çağrı / 2dk per masa (status='pending' var mı bak).
 * D4'te basit anti-spam: aynı reason için son 120sn içinde pending varsa 429.
 *
 * Auth: anon. RLS rst_table_calls INSERT policy is_published filter ediyor.
 * Cross-check: token (qr_token) → tables → restaurant.slug eşleşmesi şart.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";

export const dynamic = "force-dynamic";

const VALID_REASONS = new Set(["call", "bill_request", "complaint", "other"]);
const RATE_LIMIT_SECONDS = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; token: string }> }) {
  try {
    const { slug, token } = await ctx.params;
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restoran bulunamadı." }, { status: 404 });
    }

    // qr_token format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return NextResponse.json({ error: "Geçersiz QR token." }, { status: 400 });
    }

    const body = (await req.json()) as { reason?: string; notes?: string };
    const reason = String(body.reason || "").trim();
    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: "Geçersiz sebep." }, { status: 400 });
    }

    const sb = getServiceClient();

    // Masa lookup (token + restoran cross-check)
    const { data: table } = await sb
      .from("rst_tables")
      .select("id, label, tenant_id, restaurant_id, is_active")
      .eq("qr_token", token)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (!table || !table.is_active) {
      return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
    }

    // Rate limit: aynı masa için son 120sn içinde pending varsa 429
    const sinceIso = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
    const { data: recent } = await sb
      .from("rst_table_calls")
      .select("id, reason, status, called_at")
      .eq("table_id", table.id)
      .eq("status", "pending")
      .gte("called_at", sinceIso)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json(
        {
          error: "Çağrınız işleniyor. 2 dakika içinde yeniden deneyin.",
          retryAfterSeconds: RATE_LIMIT_SECONDS,
        },
        { status: 429 },
      );
    }

    // INSERT
    const { data: inserted, error } = await sb
      .from("rst_table_calls")
      .insert({
        tenant_id: table.tenant_id,
        restaurant_id: restaurant.id,
        table_id: table.id,
        reason,
        status: "pending",
        notes: body.notes ? String(body.notes).substring(0, 200) : null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[call-waiter] insert error", error);
      return NextResponse.json({ error: "Çağrı kaydedilemedi." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      callId: inserted.id,
      reason,
      tableLabel: table.label,
    });
  } catch (err) {
    console.error("[call-waiter]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
