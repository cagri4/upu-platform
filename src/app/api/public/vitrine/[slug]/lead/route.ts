/**
 * POST /api/public/vitrine/[slug]/lead — PUBLIC lead submit (auth yok).
 * Body: { customer_name, customer_phone?, customer_email?, message?, items? }
 * Basit rate-limit: aynı slug + customer_phone son 10 dk içinde 1 lead.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { notifyDealerNewLead } from "@/platform/bayi-vitrine/notify";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

interface LeadItem {
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const sb = getServiceClient();

  const customerName = String(body.customer_name || "").trim().slice(0, 120);
  const customerPhone = body.customer_phone ? String(body.customer_phone).trim().slice(0, 32) : null;
  const customerEmail = body.customer_email ? String(body.customer_email).trim().slice(0, 200) : null;
  const message = body.message ? String(body.message).trim().slice(0, 2000) : null;
  const itemsIn: LeadItem[] = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

  if (!customerName) {
    return NextResponse.json({ error: "İsim zorunlu." }, { status: 400 });
  }
  if (!customerPhone && !customerEmail) {
    return NextResponse.json({ error: "Telefon veya e-posta gerekli." }, { status: 400 });
  }

  const { data: vitrine } = await sb
    .from("bayi_vitrines")
    .select("id, dealer_user_id, tenant_id, slug, lead_count")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!vitrine) {
    return NextResponse.json({ error: "Vitrine bulunamadı veya kapalı." }, { status: 404 });
  }

  // Rate limit: aynı vitrine + phone son 10 dk
  if (customerPhone) {
    const tenMinAgo = new Date(Date.now() - 600_000).toISOString();
    const { data: recent } = await sb
      .from("bayi_leads")
      .select("id")
      .eq("vitrine_id", vitrine.id)
      .eq("customer_phone", customerPhone)
      .gte("created_at", tenMinAgo)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json({ error: "Az önce talep aldık — bayi yakında ulaşacak." }, { status: 429 });
    }
  }

  // Normalize items + tutar tahmini
  let estTotal = 0;
  const items = itemsIn
    .filter(it => it && typeof it === "object")
    .map(it => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Number(it.unit_price) || 0;
      estTotal += price * qty;
      return {
        product_id: it.product_id || null,
        product_name: String(it.product_name || "Ürün").slice(0, 200),
        quantity: qty,
        unit_price: price,
      };
    });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ipHash = createHash("sha256").update(ip + "|" + slug).digest("hex").slice(0, 32);

  const { data: lead, error } = await sb
    .from("bayi_leads")
    .insert({
      tenant_id: vitrine.tenant_id,
      dealer_user_id: vitrine.dealer_user_id,
      vitrine_id: vitrine.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_message: message,
      items: items.length > 0 ? items : null,
      est_total: estTotal > 0 ? estTotal : null,
      currency: "TRY",
      status: "new",
      source: "vitrine",
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
  }

  await sb.from("bayi_vitrines")
    .update({ lead_count: (vitrine.lead_count || 0) + 1 })
    .eq("id", vitrine.id);

  // Bayiye WA push (best-effort)
  void notifyDealerNewLead(sb, vitrine.dealer_user_id, {
    leadId: lead.id,
    customerName,
    customerPhone,
    itemsSummary: items.length > 0
      ? items.map(i => `${i.quantity}× ${i.product_name}`).slice(0, 3).join(", ")
      : null,
    estTotal: estTotal > 0 ? estTotal : null,
    currency: "TRY",
    vitrineSlug: slug,
  });

  return NextResponse.json({ success: true, lead_id: lead.id });
}
