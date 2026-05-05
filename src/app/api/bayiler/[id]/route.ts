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

  // Faturalar — minimal schema (id, tenant_id, dealer_id, invoice_number,
  // invoice_date, total_amount, created_at). due_date YOK; vade tracking
  // bayi_dealer_transactions'da.
  const { data: invoices, error: invErr } = await supabase
    .from("bayi_dealer_invoices")
    .select("*")
    .eq("dealer_id", id)
    .order("invoice_date", { ascending: false });
  if (invErr) console.error("[bayiler:detail] invoices query failed (devam):", invErr);

  // Vade hareketleri — bayi_dealer_transactions (sale type, due_date)
  const { data: txTypes } = await supabase
    .from("bayi_transaction_types")
    .select("id, code");
  const saleTypeId = (txTypes || []).find(t => t.code === "sale")?.id;
  const paymentTypeId = (txTypes || []).find(t => t.code === "payment")?.id;

  const { data: transactions } = await supabase
    .from("bayi_dealer_transactions")
    .select("id, dealer_id, transaction_type_id, amount, due_date, transaction_date, description, reference_number, created_at")
    .eq("dealer_id", id)
    .order("transaction_date", { ascending: false });

  const today = new Date();
  let mostOverdueDays: number | null = null;
  let openTotal = 0;
  let paidTotal = 0;
  for (const tx of (transactions || []) as Array<{
    transaction_type_id: string; amount: number; due_date: string | null;
  }>) {
    const amt = Number(tx.amount) || 0;
    if (saleTypeId && tx.transaction_type_id === saleTypeId) {
      openTotal += amt;
      if (tx.due_date) {
        const due = new Date(tx.due_date);
        const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
        if (mostOverdueDays === null || diff > mostOverdueDays) mostOverdueDays = diff;
      }
    } else if (paymentTypeId && tx.transaction_type_id === paymentTypeId) {
      paidTotal += amt;
    }
  }

  // Siparişler (son 20) + status code lookup
  const { data: statuses } = await supabase
    .from("bayi_order_statuses")
    .select("id, code, name");
  const statusCodeMap = new Map((statuses || []).map(s => [s.id, s.code as string]));

  const { data: orders, error: ordErr } = await supabase
    .from("bayi_orders")
    .select("*")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (ordErr) console.error("[bayiler:detail] orders query failed (devam):", ordErr);

  // Order items (her sipariş için kalemler)
  const orderIds = (orders || []).map((o: { id: string }) => o.id);
  const { data: orderItems } = await supabase
    .from("bayi_order_items")
    .select("order_id, product_name, quantity, unit_price, total_price")
    .in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);
  const itemsByOrder = new Map<string, Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>>();
  for (const it of (orderItems || []) as Array<{ order_id: string; product_name: string; quantity: number; unit_price: number; total_price: number }>) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id)!.push({
      product_name: it.product_name,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total_price: Number(it.total_price) || 0,
    });
  }

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
  for (const inv of (invoices || []) as Array<{ invoice_number: string; total_amount: number; invoice_date: string; created_at: string }>) {
    timeline.push({
      type: "invoice_paid",
      icon: "📄",
      title: `Fatura kesildi: ${inv.invoice_number}`,
      detail: `${Number(inv.total_amount).toLocaleString("tr-TR")} ₺`,
      timestamp: inv.created_at || inv.invoice_date,
    });
  }
  for (const tx of (transactions || []) as Array<{ transaction_type_id: string; amount: number; description: string; transaction_date: string; due_date: string | null; reference_number: string | null }>) {
    const isSale = saleTypeId && tx.transaction_type_id === saleTypeId;
    const isPayment = paymentTypeId && tx.transaction_type_id === paymentTypeId;
    timeline.push({
      type: isPayment ? "invoice_paid" : "invoice_due",
      icon: isPayment ? "✅" : isSale ? "💰" : "📊",
      title: isPayment ? "Ödeme alındı" : isSale ? `Satış işlemi${tx.due_date ? ` — vade ${tx.due_date}` : ""}` : (tx.description || "İşlem"),
      detail: `${Number(tx.amount).toLocaleString("tr-TR")} ₺${tx.reference_number ? ` · ${tx.reference_number}` : ""}`,
      timestamp: tx.transaction_date,
    });
  }
  for (const o of (orders || []) as Array<{ status_id: string; total_amount: number; created_at: string; order_number: string }>) {
    const code = statusCodeMap.get(o.status_id) || "unknown";
    timeline.push({
      type: "order",
      icon: "🛒",
      title: `Sipariş ${o.order_number} — ${code}`,
      detail: `${Number(o.total_amount).toLocaleString("tr-TR")} ₺`,
      timestamp: o.created_at,
    });
  }
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 30/60/90 gün ciro — son siparişleri tarih bucket'larına böl.
  const now = today.getTime();
  let revenue30 = 0, revenue60 = 0, revenue90 = 0;
  for (const o of orders || []) {
    const created = new Date(o.created_at).getTime();
    const days = (now - created) / 86400000;
    const total = Number(o.total_amount) || 0;
    if (days <= 30) revenue30 += total;
    if (days <= 60) revenue60 += total;
    if (days <= 90) revenue90 += total;
  }

  const tagsArr = Array.isArray(dealer.tags) ? dealer.tags as string[] : [];

  return NextResponse.json({
    dealer: {
      id: dealer.id,
      name: dealer.name || dealer.company_name || "—",
      contactName: dealer.contact_name || null,
      contactPhone: dealer.phone || dealer.contact_phone || null,
      email: dealer.email || null,
      city: dealer.city || null,
      district: dealer.district || null,
      country: dealer.country || null,
      addressLine: dealer.address_line || dealer.address || null,
      isActive: dealer.is_active !== false,
      status: dealer.status || (dealer.is_active === false ? "passive" : "active"),
      balance: Number(dealer.balance) || 0,
      creditLimit: Number(dealer.credit_limit) || 0,
      createdAt: dealer.created_at,
      code: dealer.code || null,
      tags: tagsArr,
      // Vergi & banka
      taxNumber: dealer.tax_number || null,
      taxOffice: dealer.tax_office || null,
      iban: dealer.iban || null,
    },
    finance: {
      balance: Number(dealer.balance) || 0,
      creditLimit: Number(dealer.credit_limit) || 0,
      paymentTermDays: dealer.payment_term_days ?? null,
      discountRate: dealer.discount_rate !== null && dealer.discount_rate !== undefined ? Number(dealer.discount_rate) : null,
      riskStatus: (dealer.risk_status as "clean" | "watch" | "blacklist") || "clean",
      revenue30, revenue60, revenue90,
      openTotal,
      paidTotal,
      mostOverdueDays,
      // isCritical: vade kaydı yoksa (mostOverdueDays null) ama balance > 0 ise
      // borçlu say. risk_status 'watch'/'blacklist' de kritik. Bu fallback
      // tour Task 2'nin invoice tablosu kullanılmayan tenantlarda çalışmasını
      // sağlıyor.
      isCritical:
        (mostOverdueDays !== null && mostOverdueDays >= 7) ||
        (Number(dealer.balance) || 0) > 0 ||
        (dealer.risk_status as string) === "watch" ||
        (dealer.risk_status as string) === "blacklist",
    },
    invoices: (invoices || []).slice(0, 10).map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoice_number,
      amount: Number(inv.total_amount) || 0,
      isPaid: false,                       // bu tablo paid bilgisi tutmaz
      dueDate: inv.invoice_date,
      paidAt: null,
      overdueDays: null,
    })),
    transactions: (transactions || []).slice(0, 15).map(tx => {
      const isSale = saleTypeId && tx.transaction_type_id === saleTypeId;
      const isPayment = paymentTypeId && tx.transaction_type_id === paymentTypeId;
      const overdueDays = tx.due_date ? Math.floor((today.getTime() - new Date(tx.due_date).getTime()) / 86400000) : null;
      return {
        id: tx.id,
        type: isSale ? "sale" : isPayment ? "payment" : "other",
        amount: Number(tx.amount) || 0,
        description: tx.description,
        transactionDate: tx.transaction_date,
        dueDate: tx.due_date,
        overdueDays,
        referenceNumber: tx.reference_number,
      };
    }),
    orders: (orders || []).map(o => {
      const items = itemsByOrder.get(o.id) || [];
      const totalQty = items.reduce((s, it) => s + it.quantity, 0);
      return {
      id: o.id,
      orderNumber: o.order_number,
      total: Number(o.total_amount) || 0,
      status: statusCodeMap.get(o.status_id) || "pending",
      quantity: totalQty,
      unitPrice: items[0]?.unit_price || 0,
      items: items.map(it => ({ name: it.product_name, qty: it.quantity, price: it.unit_price, total: it.total_price })),
      createdAt: o.created_at,
      };
    }),
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
