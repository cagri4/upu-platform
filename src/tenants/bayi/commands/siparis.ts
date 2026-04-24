/**
 * /siparisler — Son siparişleri listele
 * /siparisolustur — Multi-step sipariş oluşturma
 *
 * Flow: Bayi seç → Ürün seç → Miktar → Başka ürün? → Onay → DB kaydet
 *
 * Callbacks: siparis_bayi:, siparis_urun:, siparis_devam:, siparis_onay:
 * Steps: dealer → product → quantity → confirm
 */

import type { WaContext, StepHandler, CallbackHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

// ── Types ──────────────────────────────────────────────────────────────

interface OrderItem {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// ── /siparisler — List recent orders ───────────────────────────────────

export async function handleSiparisler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("order_number, total_amount, created_at, bayi_dealers!inner(company_name), bayi_order_statuses!inner(name)")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "📋 *Siparişler*\n\nHenüz sipariş bulunmuyor.", [
        { id: "cmd:siparisolustur", title: "Sipariş Oluştur" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const statusIcon: Record<string, string> = {
      Beklemede: "⏳", Onaylandi: "🟢", Hazirlaniyor: "🔄",
      Gonderildi: "📦", Yolda: "🚛", Dagitimda: "🚚",
      "Teslim Edildi": "✅", Tamamlandi: "✅", Iptal: "❌",
    };

    const lines = orders.map((o: any, i: number) => {
      const dealer = o.bayi_dealers?.company_name || "?";
      const status = o.bayi_order_statuses?.name || "?";
      const icon = statusIcon[status] || "📋";
      return `${i + 1}. ${dealer}\n   #${o.order_number} — ${formatCurrency(o.total_amount || 0)} — ${icon} ${status}`;
    });

    await sendButtons(
      ctx.phone,
      `📋 *Son Siparişler*\n\n${lines.join("\n\n")}`,
      [
        { id: "cmd:siparisolustur", title: "Yeni Sipariş" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
    await logEvent(ctx.tenantId, ctx.userId, "siparisler", `${orders.length} sipariş listelendi`);
  } catch (err) {
    await handleError(ctx, "bayi:siparisler", err, "db");
  }
}

// ── /siparisolustur — open the web form via magic-link ──────────────────

export async function handleSiparisOlustur(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await supabase.from("magic_link_tokens").insert({
      user_id: ctx.userId,
      token,
      expires_at: expiresAt,
    });

    const formUrl = `https://retailai.upudev.nl/tr/bayi-siparis?t=${token}`;
    const { sendUrlButton } = await import("@/platform/whatsapp/send");
    await sendUrlButton(ctx.phone,
      `📦 *Yeni Sipariş*\n\nBayi ve ürünleri rahatça seçebilesin diye formu açtım. Doldur, kaydet — WhatsApp'a onay düşer.\n\n_Link 2 saat geçerli._`,
      "📝 Formu Aç",
      formUrl,
      { skipNav: true },
    );
  } catch (err) {
    await handleError(ctx, "bayi:siparisolustur", err, "db");
  }
}

// ── Callback: siparis_bayi:<id> — dealer selected ──────────────────────

export const handleSiparisBayiCallback: CallbackHandler = async (ctx, callbackData) => {
  try {
    const dealerId = callbackData.replace("siparis_bayi:", "");
    const supabase = getServiceClient();

    const { data: dealer } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("id", dealerId)
      .single();

    if (!dealer) {
      await sendText(ctx.phone, "Bayi bulunamadı.");
      await endSession(ctx.userId);
      return;
    }

    await updateSession(ctx.userId, "product", {
      dealer_id: dealer.id,
      dealer_name: dealer.company_name,
      items: [],
    });

    await showProductSelection(ctx);
  } catch (err) {
    await handleError(ctx, "bayi:siparis_bayi", err, "db");
    await endSession(ctx.userId);
  }
};

// ── Show product list ──────────────────────────────────────────────────

async function showProductSelection(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: products } = await supabase
    .from("bayi_products")
    .select("id, code, name, base_price, stock_quantity")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("name")
    .limit(10);

  if (!products?.length) {
    await sendButtons(ctx.phone, "Stokta ürün bulunmuyor.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await endSession(ctx.userId);
    return;
  }

  const rows = products.map(p => ({
    id: `siparis_urun:${p.id}`,
    title: p.name.substring(0, 24),
    description: `${formatCurrency(p.base_price)} — Stok: ${p.stock_quantity}`,
  }));

  await sendList(
    ctx.phone,
    "Ürün seçin:",
    "Ürünler",
    [{ title: "Ürün Kataloğu", rows }],
  );
}

// ── Callback: siparis_urun:<id> — product selected ─────────────────────

export const handleSiparisUrunCallback: CallbackHandler = async (ctx, callbackData) => {
  try {
    const productId = callbackData.replace("siparis_urun:", "");
    const supabase = getServiceClient();

    const { data: product } = await supabase
      .from("bayi_products")
      .select("id, code, name, base_price, stock_quantity")
      .eq("id", productId)
      .single();

    if (!product) {
      await sendText(ctx.phone, "Ürün bulunamadı.");
      return;
    }

    await updateSession(ctx.userId, "quantity", {
      current_product: {
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.base_price,
        stock: product.stock_quantity,
      },
    });

    await sendText(
      ctx.phone,
      `📦 *${product.name}*\nFiyat: ${formatCurrency(product.base_price)}\nStok: ${product.stock_quantity}\n\nKaç adet?`,
    );
  } catch (err) {
    await handleError(ctx, "bayi:siparis_urun", err, "db");
  }
};

// ── Callback: siparis_devam: — add more or confirm ─────────────────────

export const handleSiparisDevamCallback: CallbackHandler = async (ctx, callbackData) => {
  const action = callbackData.replace("siparis_devam:", "");

  if (action === "evet") {
    await showProductSelection(ctx);
  } else {
    await showOrderSummary(ctx);
  }
};

// ── Callback: siparis_onay: — confirm or cancel ────────────────────────

export const handleSiparisOnayCallback: CallbackHandler = async (ctx, callbackData) => {
  const action = callbackData.replace("siparis_onay:", "");

  if (action === "onayla") {
    await saveOrder(ctx);
  } else {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Sipariş iptal edildi.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  }
};

// ── Step handler: quantity input (free text) ───────────────────────────

export const handleSiparisStep: StepHandler = async (ctx, session) => {
  if (session.current_step !== "quantity") return;

  const data = session.data as {
    dealer_id: string;
    dealer_name: string;
    items: OrderItem[];
    current_product: { id: string; code: string; name: string; price: number; stock: number };
  };

  if (!data.current_product) {
    await sendText(ctx.phone, "Lütfen önce ürün seçin.");
    return;
  }

  const qty = parseInt(ctx.text.trim(), 10);
  if (isNaN(qty) || qty <= 0) {
    await sendText(ctx.phone, "Lütfen geçerli bir sayı girin. Örnek: 50");
    return;
  }

  if (qty > data.current_product.stock) {
    await sendText(
      ctx.phone,
      `Stokta ${data.current_product.stock} adet var. Lütfen daha düşük miktar girin.`,
    );
    return;
  }

  // Add item to list
  const newItem: OrderItem = {
    product_id: data.current_product.id,
    product_code: data.current_product.code,
    product_name: data.current_product.name,
    quantity: qty,
    unit_price: data.current_product.price,
    total_price: qty * data.current_product.price,
  };

  const items = [...(data.items || []), newItem];
  await updateSession(ctx.userId, "more", {
    items,
    current_product: null,
  });

  // Ask if more items
  const total = items.reduce((s, i) => s + i.total_price, 0);
  await sendButtons(
    ctx.phone,
    `✅ ${newItem.product_name} x${qty} — ${formatCurrency(newItem.total_price)} eklendi.\n\nSepet: ${items.length} kalem — ${formatCurrency(total)}\n\nBaşka ürün eklensin mi?`,
    [
      { id: "siparis_devam:evet", title: "Evet, ekle" },
      { id: "siparis_devam:hayir", title: "Tamamla" },
    ],
  );
};

// ── Show order summary ─────────────────────────────────────────────────

async function showOrderSummary(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!session?.data) return;

  const data = session.data as {
    dealer_name: string;
    items: OrderItem[];
  };

  const lines = data.items.map((item, i) =>
    `${i + 1}. ${item.product_name}\n   ${item.quantity} adet x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total_price)}`,
  );

  const total = data.items.reduce((s, i) => s + i.total_price, 0);

  await sendButtons(
    ctx.phone,
    `📋 *Sipariş Özeti*\n\nBayi: *${data.dealer_name}*\n\n${lines.join("\n\n")}\n\n*Toplam: ${formatCurrency(total)}*`,
    [
      { id: "siparis_onay:onayla", title: "✅ Onayla" },
      { id: "siparis_onay:iptal", title: "❌ İptal" },
    ],
  );
}

// ── Save order to DB ───────────────────────────────────────────────────

async function saveOrder(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data: session } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .single();

    if (!session?.data) {
      await sendText(ctx.phone, "Sipariş verisi bulunamadı.");
      return;
    }

    const data = session.data as {
      dealer_id: string;
      dealer_name: string;
      items: OrderItem[];
    };

    const total = data.items.reduce((s, i) => s + i.total_price, 0);

    // Generate order number: SIP-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SIP-${dateStr}-${rand}`;

    // Get pending status ID
    const { data: pendingStatus } = await supabase
      .from("bayi_order_statuses")
      .select("id")
      .eq("code", "pending")
      .single();

    // Insert order
    const { data: order, error: orderErr } = await supabase
      .from("bayi_orders")
      .insert({
        tenant_id: ctx.tenantId,
        order_number: orderNumber,
        dealer_id: data.dealer_id,
        status_id: pendingStatus?.id,
        subtotal: total,
        total_amount: total,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("[bayi:siparis] order insert error:", orderErr);
      await sendText(ctx.phone, "Sipariş kaydedilirken hata oluştu. Lütfen tekrar deneyin.");
      return;
    }

    // Insert order items
    const itemRows = data.items.map(item => ({
      tenant_id: ctx.tenantId,
      order_id: order.id,
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    await supabase.from("bayi_order_items").insert(itemRows);

    // Create cari transaction (debit — bayi borçlanır)
    const { data: saleType } = await supabase
      .from("bayi_transaction_types")
      .select("id")
      .eq("code", "sale")
      .single();

    if (saleType) {
      await supabase.from("bayi_dealer_transactions").insert({
        tenant_id: ctx.tenantId,
        dealer_id: data.dealer_id,
        transaction_type_id: saleType.id,
        amount: total,
        order_id: order.id,
        description: `Sipariş ${orderNumber}`,
        transaction_date: now.toISOString().slice(0, 10),
      });
    }

    // Update product stock
    for (const item of data.items) {
      const { data: prod } = await supabase
        .from("bayi_products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();
      if (prod) {
        await supabase.from("bayi_products")
          .update({ stock_quantity: Math.max(0, prod.stock_quantity - item.quantity) })
          .eq("id", item.product_id);
      }
    }

    await endSession(ctx.userId);

    await logEvent(ctx.tenantId, ctx.userId, "siparis_olusturuldu", `${orderNumber} — ${data.dealer_name} — ${formatCurrency(total)}`);

    await sendButtons(
      ctx.phone,
      `✅ *Sipariş Oluşturuldu*\n\nSipariş No: *${orderNumber}*\nBayi: ${data.dealer_name}\nTutar: ${formatCurrency(total)}\nDurum: ⏳ Beklemede\n\nDepo bilgilendirildi.`,
      [
        { id: "cmd:siparisler", title: "Siparişler" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    await handleError(ctx, "bayi:siparis_save", err, "db");
    await endSession(ctx.userId);
  }
}
