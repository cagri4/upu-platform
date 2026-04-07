/**
 * Dealer-facing commands — bayinin kendi kullandığı komutlar
 *
 * Dealer user_id → profiles.invited_by ile firma sahibine bağlı
 * Dealer tenant_id üzerinden aynı tenant'ta, ama verileri invited_by filtresiyle
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

// ── Helper: get owner user_id (firma sahibi) ─────────────────────────

async function getOwnerId(ctx: WaContext): Promise<string | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("invited_by")
    .eq("id", ctx.userId)
    .single();
  return data?.invited_by || null;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

// ── siparisver — Ürün kataloğundan sipariş oluştur ──────────────────

export async function handleDealerSiparisVer(ctx: WaContext): Promise<void> {
  try {
    const ownerId = await getOwnerId(ctx);
    if (!ownerId) {
      await sendButtons(ctx.phone, "Firma bilgisi bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();
    const { data: products } = await supabase
      .from("bayi_products")
      .select("id, name, unit_price, stock_quantity, category")
      .eq("user_id", ownerId)
      .gt("stock_quantity", 0)
      .order("name")
      .limit(10);

    if (!products?.length) {
      await sendButtons(ctx.phone, "Şu an sipariş verilebilecek ürün bulunmuyor.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const rows = products.map(p => ({
      id: `dealer_siparis:${p.id}`,
      title: p.name.substring(0, 24),
      description: `${formatPrice(p.unit_price)} TL | Stok: ${p.stock_quantity}`,
    }));

    await sendList(ctx.phone, "📦 Sipariş vermek istediğiniz ürünü seçin:", "Ürün Seç", [
      { title: "Ürünler", rows },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:siparisver", err, "db");
  }
}

// ── siparislerim — Kendi siparişlerimi listele ──────────────────────

export async function handleDealerSiparislerim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Find dealer record linked to this profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("dealer_id")
      .eq("id", ctx.userId)
      .single();

    const dealerId = profile?.dealer_id;

    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("id, status, total_amount, created_at, notes")
      .eq("tenant_id", ctx.tenantId)
      .eq("dealer_id", dealerId || ctx.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "Henüz siparişiniz bulunmuyor.", [
        { id: "cmd:siparisver", title: "📦 Sipariş Ver" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    let text = "📋 *Siparişlerim*\n\n";
    for (const o of orders) {
      const date = new Date(o.created_at).toLocaleDateString("tr-TR");
      const statusMap: Record<string, string> = {
        pending: "⏳ Beklemede", beklemede: "⏳ Beklemede",
        confirmed: "✅ Onaylandı", onaylandi: "✅ Onaylandı",
        shipped: "🚛 Kargoda", completed: "✅ Tamamlandı",
        tamamlandi: "✅ Tamamlandı", cancelled: "❌ İptal",
      };
      text += `${statusMap[o.status] || o.status} | ${formatPrice(o.total_amount || 0)} TL | ${date}\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:siparisver", title: "📦 Yeni Sipariş" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:siparislerim", err, "db");
  }
}

// ── tekrarsiparis — Son siparişi tekrarla ───────────────────────────

export async function handleDealerTekrarSiparis(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", ctx.userId).single();
    const dealerId = profile?.dealer_id;

    const { data: lastOrder } = await supabase
      .from("bayi_orders")
      .select("id, total_amount, notes")
      .eq("tenant_id", ctx.tenantId)
      .eq("dealer_id", dealerId || ctx.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastOrder) {
      await sendButtons(ctx.phone, "Tekrarlanacak sipariş bulunamadı.", [
        { id: "cmd:siparisver", title: "📦 Yeni Sipariş" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    // Get items from last order
    const { data: items } = await supabase
      .from("bayi_order_items")
      .select("product_id, quantity, unit_price")
      .eq("order_id", lastOrder.id);

    if (!items?.length) {
      await sendButtons(ctx.phone, "Son siparişin detayları bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    // Get product names
    const prodIds = items.map(i => i.product_id);
    const { data: products } = await supabase.from("bayi_products").select("id, name").in("id", prodIds);
    const nameMap: Record<string, string> = {};
    for (const p of products || []) nameMap[p.id] = p.name;

    let text = "🔄 *Son Siparişi Tekrarla*\n\n";
    for (const item of items) {
      text += `• ${nameMap[item.product_id] || "?"} x${item.quantity} — ${formatPrice(item.unit_price * item.quantity)} TL\n`;
    }
    text += `\n💰 Toplam: ${formatPrice(lastOrder.total_amount || 0)} TL`;

    await sendButtons(ctx.phone, text, [
      { id: `dealer_tekrar:${lastOrder.id}`, title: "✅ Onayla" },
      { id: "cmd:siparisver", title: "📦 Farklı Sipariş" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:tekrarsiparis", err, "db");
  }
}

// ── bakiyem — Kendi bakiye/borç durumum ─────────────────────────────

export async function handleDealerBakiyem(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", ctx.userId).single();

    if (!profile?.dealer_id) {
      await sendButtons(ctx.phone, "Bakiye bilgisi bulunamadı. Profil ayarlarınızı kontrol edin.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const { data: dealer } = await supabase
      .from("bayi_dealers")
      .select("name, balance, status")
      .eq("id", profile.dealer_id)
      .single();

    if (!dealer) {
      await sendButtons(ctx.phone, "Bayi kaydınız bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const balance = dealer.balance || 0;
    const emoji = balance > 0 ? "🔴" : balance < 0 ? "🟢" : "⚪";

    let text = `💰 *Bakiye Durumum*\n\n`;
    text += `🏢 ${dealer.name}\n`;
    text += `${emoji} Bakiye: ${formatPrice(Math.abs(balance))} TL`;
    text += balance > 0 ? " (borç)\n" : balance < 0 ? " (alacak)\n" : "\n";

    await sendButtons(ctx.phone, text, [
      { id: "cmd:faturalarim", title: "📄 Faturalarım" },
      { id: "cmd:odemelerim", title: "💳 Ödemelerim" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:bakiyem", err, "db");
  }
}

// ── faturalarim — Kendi faturalarım ─────────────────────────────────

export async function handleDealerFaturalarim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", ctx.userId).single();

    const { data: invoices } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, invoice_no, amount, status, due_date, created_at")
      .eq("dealer_id", profile?.dealer_id || ctx.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Henüz faturanız bulunmuyor.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = "📄 *Faturalarım*\n\n";
    for (const inv of invoices) {
      const date = new Date(inv.created_at).toLocaleDateString("tr-TR");
      const status = inv.status === "paid" ? "✅" : inv.status === "overdue" ? "🔴" : "⏳";
      text += `${status} ${inv.invoice_no || "-"} | ${formatPrice(inv.amount || 0)} TL | ${date}\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:bakiyem", title: "💰 Bakiyem" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:faturalarim", err, "db");
  }
}

// ── odemelerim — Ödeme geçmişim ─────────────────────────────────────

export async function handleDealerOdemelerim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from("profiles").select("dealer_id").eq("id", ctx.userId).single();

    const { data: payments } = await supabase
      .from("bayi_dealer_transactions")
      .select("id, amount, type, description, created_at")
      .eq("dealer_id", profile?.dealer_id || ctx.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!payments?.length) {
      await sendButtons(ctx.phone, "Henüz ödeme kaydınız bulunmuyor.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = "💳 *Ödeme Geçmişim*\n\n";
    for (const p of payments) {
      const date = new Date(p.created_at).toLocaleDateString("tr-TR");
      const icon = p.type === "payment" ? "💚" : "📄";
      text += `${icon} ${formatPrice(p.amount || 0)} TL | ${p.description || p.type} | ${date}\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:bakiyem", title: "💰 Bakiyem" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:odemelerim", err, "db");
  }
}

// ── urunler/fiyatlar — Ürün kataloğu (read-only) ───────────────────

export async function handleDealerUrunler(ctx: WaContext): Promise<void> {
  try {
    const ownerId = await getOwnerId(ctx);
    if (!ownerId) {
      await sendButtons(ctx.phone, "Katalog bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();
    const { data: products } = await supabase
      .from("bayi_products")
      .select("id, name, unit_price, stock_quantity, category")
      .eq("user_id", ownerId)
      .order("category", { ascending: true })
      .limit(20);

    if (!products?.length) {
      await sendButtons(ctx.phone, "Henüz ürün kataloğu oluşturulmamış.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = "🏷 *Ürün Kataloğu*\n\n";
    let currentCat = "";
    for (const p of products) {
      if (p.category && p.category !== currentCat) {
        currentCat = p.category;
        text += `\n*${currentCat}*\n`;
      }
      const stockLabel = p.stock_quantity > 0 ? "✅" : "❌ Stokta yok";
      text += `• ${p.name} — ${formatPrice(p.unit_price)} TL ${p.stock_quantity <= 0 ? stockLabel : ""}\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:siparisver", title: "📦 Sipariş Ver" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:urunler", err, "db");
  }
}

// ── kampanyalar — Aktif kampanyalar ──────────────────────────────────

export async function handleDealerKampanyalar(ctx: WaContext): Promise<void> {
  try {
    const ownerId = await getOwnerId(ctx);
    if (!ownerId) {
      await sendButtons(ctx.phone, "Kampanya bilgisi bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const supabase = getServiceClient();
    const { data: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("id, name, description, discount_type, discount_value, start_date, end_date, status")
      .eq("user_id", ownerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!campaigns?.length) {
      await sendButtons(ctx.phone, "Şu an aktif kampanya bulunmuyor.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    let text = "🎯 *Aktif Kampanyalar*\n\n";
    for (const c of campaigns) {
      text += `🏷 *${c.name}*\n`;
      if (c.description) text += `${c.description}\n`;
      if (c.discount_value) {
        const disc = c.discount_type === "percent" ? `%${c.discount_value} indirim` : `${formatPrice(c.discount_value)} TL indirim`;
        text += `💰 ${disc}\n`;
      }
      if (c.end_date) text += `⏰ Son: ${new Date(c.end_date).toLocaleDateString("tr-TR")}\n`;
      text += `\n`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:siparisver", title: "📦 Sipariş Ver" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    await handleError(ctx, "dealer:kampanyalar", err, "db");
  }
}

// ── mesajgonder — Firmaya mesaj gönder ──────────────────────────────

export async function handleDealerMesajGonder(ctx: WaContext): Promise<void> {
  try {
    const { sendText: sendMsg } = await import("@/platform/whatsapp/send");
    const { startSession } = await import("@/platform/whatsapp/session");

    await startSession(ctx.userId, ctx.tenantId, "dealer_mesaj", "waiting_message");
    await sendMsg(ctx.phone, "✉️ Firmaya göndermek istediğiniz mesajı yazın:\n\n(\"iptal\" ile vazgeçin)");
  } catch (err) {
    await handleError(ctx, "dealer:mesajgonder", err, "db");
  }
}

// ── Step handler for dealer message ─────────────────────────────────

export async function handleDealerMesajStep(ctx: WaContext): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) return;

  const { endSession } = await import("@/platform/whatsapp/session");
  await endSession(ctx.userId);

  const ownerId = await getOwnerId(ctx);
  if (!ownerId) {
    await sendButtons(ctx.phone, "Firma bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Get owner's phone
  const supabase = getServiceClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("whatsapp_phone, display_name")
    .eq("id", ownerId)
    .single();

  if (owner?.whatsapp_phone) {
    const { data: dealerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", ctx.userId)
      .single();

    const dealerName = dealerProfile?.display_name || ctx.userName;
    await sendText(owner.whatsapp_phone,
      `📩 *Bayi Mesajı*\n\nGönderen: ${dealerName}\n\n${text}`
    );
  }

  await sendButtons(ctx.phone, "✅ Mesajınız firmaya iletildi.", [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}
