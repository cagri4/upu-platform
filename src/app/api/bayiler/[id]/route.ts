/**
 * GET /api/bayiler/[id] — bayi detay tek endpoint.
 *
 * Tek bir bayi için:
 *   - Temel bilgiler (isim, kontak, durum, etiketler, bakiye)
 *   - Finansal: bakiye, vade hareketleri (geç/bekleyen/ödendi)
 *   - Son 20 sipariş (status, tutar, tarih)
 *   - Timeline: notlar (varsa) + vade ödemeleri + sipariş eventleri
 *
 * Magic-link auth (token query param). Sahip-only — başka tenant'ın
 * bayisini açamasın.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  // Bayi
  const { data: dealer, error: dErr } = await supabase
    .from("bayi_dealers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (dErr) {
    console.error("[bayiler:detail] dealer query failed:", dErr);
    return NextResponse.json({ error: "Bayi sorgusu başarısız", details: dErr.message, code: dErr.code }, { status: 500 });
  }
  if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı veya yetki yok." }, { status: 404 });

  // Vade / faturalar — schema kolon farkları için *
  const { data: invoices, error: invErr } = await supabase
    .from("bayi_dealer_invoices")
    .select("*")
    .eq("dealer_id", id)
    .order("due_date", { ascending: false });
  if (invErr) console.error("[bayiler:detail] invoices query failed (devam):", invErr);

  const today = new Date();
  let mostOverdueDays: number | null = null;
  let openTotal = 0;
  let paidTotal = 0;
  for (const inv of invoices || []) {
    if (inv.is_paid) {
      paidTotal += Number(inv.amount) || 0;
    } else {
      openTotal += Number(inv.amount) || 0;
      const due = new Date(inv.due_date);
      const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (mostOverdueDays === null || diff > mostOverdueDays) mostOverdueDays = diff;
    }
  }

  // Siparişler (son 20)
  const { data: orders, error: ordErr } = await supabase
    .from("bayi_orders")
    .select("*")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (ordErr) console.error("[bayiler:detail] orders query failed (devam):", ordErr);

  // Notlar / mesajlar / kampanyalar — opsiyonel tablolar; yoksa null/boş.
  const { data: notes } = await supabase
    .from("bayi_dealer_notes")
    .select("*")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: messages } = await supabase
    .from("bayi_dealer_messages")
    .select("*")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Bayi-özel kampanyalar
  const { data: campaigns } = await supabase
    .from("bayi_dealer_campaigns")
    .select("*")
    .eq("dealer_id", id)
    .order("starts_at", { ascending: false })
    .limit(10);

  // Timeline merge — created_at'e göre sırala
  type TimelineItem = {
    type: "note" | "message" | "invoice_paid" | "invoice_due" | "order";
    icon: string;
    title: string;
    detail?: string;
    timestamp: string;
    raw?: Record<string, unknown>;
  };
  const timeline: TimelineItem[] = [];
  for (const n of notes || []) {
    timeline.push({
      type: "note",
      icon: "📝",
      title: "Not eklendi",
      detail: n.content,
      timestamp: n.created_at,
    });
  }
  for (const m of messages || []) {
    timeline.push({
      type: "message",
      icon: m.direction === "outbound" ? "📤" : "📥",
      title: m.direction === "outbound" ? "WhatsApp gönderildi" : "WhatsApp alındı",
      detail: m.content,
      timestamp: m.created_at,
    });
  }
  for (const inv of invoices || []) {
    if (inv.is_paid && inv.paid_at) {
      timeline.push({
        type: "invoice_paid",
        icon: "✅",
        title: `Fatura ödendi: ${inv.invoice_no}`,
        detail: `${Number(inv.amount).toLocaleString("tr-TR")} ₺`,
        timestamp: inv.paid_at,
      });
    }
  }
  for (const o of orders || []) {
    timeline.push({
      type: "order",
      icon: "🛒",
      title: `Sipariş — ${o.status}`,
      detail: `${Number(o.total_amount).toLocaleString("tr-TR")} ₺`,
      timestamp: o.created_at,
    });
  }
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    dealer: {
      id: dealer.id,
      name: dealer.name || dealer.company_name || "—",
      contactName: dealer.contact_name || null,
      contactPhone: dealer.contact_phone || dealer.phone || null,
      email: dealer.email || null,
      city: dealer.city || null,
      country: dealer.country || null,
      address: dealer.address || null,
      isActive: dealer.is_active !== false,
      balance: Number(dealer.balance) || 0,
      creditLimit: Number(dealer.credit_limit) || 0,
      createdAt: dealer.created_at,
      code: dealer.code || null,
    },
    finance: {
      balance: Number(dealer.balance) || 0,
      creditLimit: Number(dealer.credit_limit) || 0,
      openTotal,
      paidTotal,
      mostOverdueDays,
      isCritical: mostOverdueDays !== null && mostOverdueDays >= 7,
    },
    invoices: (invoices || []).slice(0, 10).map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      amount: Number(inv.amount) || 0,
      isPaid: inv.is_paid,
      dueDate: inv.due_date,
      paidAt: inv.paid_at,
      overdueDays: inv.is_paid ? null : Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000),
    })),
    orders: (orders || []).map(o => ({
      id: o.id,
      total: Number(o.total_amount) || 0,
      status: o.status,
      quantity: o.quantity || 0,
      unitPrice: Number(o.unit_price) || 0,
      createdAt: o.created_at,
    })),
    timeline: timeline.slice(0, 30),
    campaigns: (campaigns || []).map(c => ({
      id: c.id,
      name: c.name,
      discountType: c.discount_type,
      discountValue: Number(c.discount_value) || 0,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      isActive: c.is_active,
    })),
  });
}
