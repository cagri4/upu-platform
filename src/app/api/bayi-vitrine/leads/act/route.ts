/**
 * POST /api/bayi-vitrine/leads/act — lead status değiştirir.
 * Body: { token?, id, action: 'contact'|'convert'|'reject', notes? }
 * 'convert' → bayi_dealer_orders'a pending sipariş açar + converted_order_id set.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["contact", "convert", "reject"]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const leadId = String(body.id || "");
  const action = String(body.action || "");
  if (!leadId || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "Geçersiz parametre." }, { status: 400 });
  }

  const { data: lead, error: leadErr } = await sb
    .from("bayi_leads")
    .select("id, dealer_user_id, vitrine_id, items, est_total, currency, customer_name, status, converted_order_id, tenant_id")
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) return NextResponse.json({ error: "Lead bulunamadı." }, { status: 404 });
  if (lead.dealer_user_id !== lookup.profile.id) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (action === "contact") {
    updates.status = "contacted";
    updates.contacted_at = nowIso;
  } else if (action === "reject") {
    updates.status = "rejected";
    updates.rejected_at = nowIso;
  } else if (action === "convert") {
    if (lead.converted_order_id) {
      return NextResponse.json({ error: "Lead zaten dönüştürülmüş." }, { status: 409 });
    }
    const items = Array.isArray(lead.items) ? lead.items : [];
    const total = Number(lead.est_total) || 0;
    const { data: order, error: orderErr } = await sb
      .from("bayi_dealer_orders")
      .insert({
        tenant_id: lookup.tenantId,
        dealer_user_id: lookup.profile.id,
        status: "pending",
        total_amount: total,
        currency: lead.currency || "TRY",
        notes: `Vitrine lead'inden dönüştürüldü: ${lead.customer_name}`,
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message || "Sipariş açılamadı." }, { status: 500 });
    }

    if (items.length > 0) {
      const orderItems = items
        .filter((it: { product_id?: string; product_name?: string; quantity?: number; unit_price?: number }) =>
          it && typeof it === "object")
        .map((it: { product_id?: string; product_name?: string; quantity?: number; unit_price?: number }) => ({
          order_id: order.id,
          product_id: it.product_id || null,
          product_name: String(it.product_name || "Ürün").slice(0, 200),
          unit_price: Number(it.unit_price) || 0,
          quantity: Math.max(1, Number(it.quantity) || 1),
          line_total: (Number(it.unit_price) || 0) * Math.max(1, Number(it.quantity) || 1),
        }));
      if (orderItems.length > 0) {
        await sb.from("bayi_dealer_order_items").insert(orderItems);
      }
    }

    updates.status = "converted";
    updates.converted_at = nowIso;
    updates.converted_order_id = order.id;

    // Vitrine conversion sayacı
    if (lead.vitrine_id) {
      const { data: v } = await sb.from("bayi_vitrines").select("conversion_count").eq("id", lead.vitrine_id).single();
      if (v) {
        await sb.from("bayi_vitrines").update({ conversion_count: (v.conversion_count || 0) + 1 }).eq("id", lead.vitrine_id);
      }
    }
  }

  if (body.notes !== undefined) {
    updates.notes = String(body.notes || "").slice(0, 1000) || null;
  }

  const { error: updErr } = await sb.from("bayi_leads").update(updates).eq("id", leadId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: nowIso }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, action, converted_order_id: updates.converted_order_id || null });
}
