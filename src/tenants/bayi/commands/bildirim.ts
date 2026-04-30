/**
 * Bayi Bildirim Sistemi — firma ↔ bayi interaktif iletişim
 *
 * - Kampanya bildirimi → tüm bayilere
 * - Tahsilat hatırlatma → borçlu bayilere
 * - Sipariş bildirimi → firmaya (otomatik, dealer.ts'den çağrılır)
 * - Duyuru → tüm bayilere serbest mesaj
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";
import { formatCurrency, type SupportedCurrency, type SupportedLocale } from "@/platform/i18n/currency";

function formatPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

/**
 * Owner profilinden currency + locale + payment adapter okur. Tahsilat
 * mesajının doğru para birimi + ödeme yöntemiyle gitmesi için.
 */
async function getOwnerLocaleAndPayment(userId: string): Promise<{
  currency: SupportedCurrency;
  locale: SupportedLocale;
  payment: string;
}> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const localeSettings = (meta.tenant_locale || {}) as Record<string, unknown>;
  const adapters = (meta.enabled_adapters || {}) as Record<string, unknown>;
  return {
    currency: (localeSettings.currency as SupportedCurrency) || "EUR",
    locale: (localeSettings.locale as SupportedLocale) || "tr-NL",
    payment: (adapters.payment as string) || "manual",
  };
}

function paymentMethodHint(payment: string): string {
  if (payment === "mollie") return "iDEAL veya SEPA otomatik tahsilat ile ödeyebilirsiniz.";
  if (payment === "stripe") return "Kart veya banka transferi ile ödeyebilirsiniz.";
  if (payment === "iyzico") return "Kart veya havale ile ödeyebilirsiniz.";
  return "Banka transferi veya yüz yüze ödeme yapabilirsiniz.";
}

// ── Helper: get all dealer phones for this firm owner ───────────────

async function getDealerPhones(userId: string): Promise<Array<{ phone: string; name: string; id: string }>> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, whatsapp_phone")
    .eq("invited_by", userId)
    .eq("role", "dealer")
    .not("whatsapp_phone", "is", null);

  return (data || []).map(d => ({
    id: d.id,
    phone: d.whatsapp_phone!,
    name: d.display_name || "Bayi",
  }));
}

// ── /kampanyabildir — Kampanyayı bayilere gönder ────────────────────

export async function handleKampanyaBildir(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin" && ctx.role !== "employee") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("id, title, description, start_date, end_date, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!campaigns?.length) {
      await sendButtons(ctx.phone, "Aktif kampanya yok. Önce kampanya oluşturun.", [
        { id: "cmd:kampanyaolustur", title: "Kampanya Oluştur" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const rows = campaigns.map(c => ({
      id: `kmp_bildir:${c.id}`,
      title: (c.title || "Kampanya").substring(0, 24),
      description: (c.description || "").substring(0, 72),
    }));

    await sendList(ctx.phone, "📢 Bayilere bildirmek istediğiniz kampanyayı seçin:", "Kampanya Seç", [
      { title: "Aktif Kampanyalar", rows },
    ]);
  } catch (err) {
    await handleError(ctx, "bayi:kampanyabildir", err, "db");
  }
}

export async function handleKampanyaBildirCallback(ctx: WaContext, data: string): Promise<void> {
  const campaignId = data.replace("kmp_bildir:", "");

  const supabase = getServiceClient();
  const { data: campaign } = await supabase
    .from("bayi_campaigns")
    .select("title, description, start_date, end_date")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    await sendButtons(ctx.phone, "Kampanya bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const dealers = await getDealerPhones(ctx.userId);
  if (dealers.length === 0) {
    await sendButtons(ctx.phone, "Kayıtlı bayi yok. Bayilerinizi davet edin.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Send to all dealers
  let sent = 0;
  for (const dealer of dealers) {
    try {
      let msg = `🎯 *Yeni Kampanya!*\n\n`;
      msg += `📌 *${campaign.title}*\n`;
      if (campaign.description) msg += `${campaign.description}\n`;
      if (campaign.end_date) msg += `\n⏰ Son tarih: ${new Date(campaign.end_date).toLocaleDateString("tr-TR")}\n`;
      msg += `\nBu kampanyadan yararlanmak için sipariş verin!`;

      await sendButtons(dealer.phone, msg, [
        { id: "cmd:siparisver", title: "📦 Sipariş Ver" },
        { id: "cmd:aktifkampanyalar", title: "🎯 Kampanyalar" },
      ]);
      sent++;
    } catch { /* skip failed sends */ }
  }

  await sendButtons(ctx.phone,
    `✅ Kampanya bildirimi gönderildi!\n\n📌 ${campaign.title}\n📤 ${sent}/${dealers.length} bayiye iletildi`,
    [{ id: "cmd:menu", title: "Ana Menü" }],
  );
}

// ── /tahsilatbildir — Borçlu bayilere hatırlatma gönder ─────────────

export async function handleTahsilatBildir(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin" && ctx.role !== "employee") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();

    // Get dealers with balance > 0, find their phone numbers
    const { data: debtDealers } = await supabase
      .from("bayi_dealers")
      .select("id, name, balance")
      .eq("tenant_id", ctx.tenantId)
      .gt("balance", 0)
      .order("balance", { ascending: false })
      .limit(10);

    if (!debtDealers?.length) {
      await sendButtons(ctx.phone, "✅ Borçlu bayi bulunmuyor!", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    // Match dealers to profiles (via dealer_id)
    const dealerIds = debtDealers.map(d => d.id);
    const { data: dealerProfiles } = await supabase
      .from("profiles")
      .select("dealer_id, whatsapp_phone, display_name")
      .in("dealer_id", dealerIds)
      .not("whatsapp_phone", "is", null);

    const phoneMap: Record<string, string> = {};
    for (const p of dealerProfiles || []) {
      if (p.dealer_id && p.whatsapp_phone) phoneMap[p.dealer_id] = p.whatsapp_phone;
    }

    let text = `💳 *Tahsilat Hatırlatma*\n\nBorçlu bayiler:\n\n`;
    const sendable: Array<{ name: string; balance: number; phone: string }> = [];

    for (const d of debtDealers) {
      const phone = phoneMap[d.id];
      text += `• ${d.name}: ${formatPrice(d.balance)} TL ${phone ? "📱" : "⚠️ Telefon yok"}\n`;
      if (phone) sendable.push({ name: d.name, balance: d.balance, phone });
    }

    if (sendable.length === 0) {
      text += `\n⚠️ Hiçbir borçlu bayinin telefonu kayıtlı değil.`;
      await sendButtons(ctx.phone, text, [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    text += `\n📤 ${sendable.length} bayiye hatırlatma gönderilecek.`;

    await sendButtons(ctx.phone, text, [
      { id: "tahsilat_gonder:all", title: `📤 Hepsine Gönder (${sendable.length})` },
      { id: "cmd:menu", title: "İptal" },
    ]);
  } catch (err) {
    await handleError(ctx, "bayi:tahsilatbildir", err, "db");
  }
}

export async function handleTahsilatBildirCallback(ctx: WaContext, data: string): Promise<void> {
  if (data !== "tahsilat_gonder:all") return;

  const supabase = getServiceClient();
  const { data: debtDealers } = await supabase
    .from("bayi_dealers")
    .select("id, name, balance")
    .eq("tenant_id", ctx.tenantId)
    .gt("balance", 0);

  const dealerIds = (debtDealers || []).map(d => d.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("dealer_id, whatsapp_phone")
    .in("dealer_id", dealerIds)
    .not("whatsapp_phone", "is", null);

  const phoneMap: Record<string, string> = {};
  for (const p of profiles || []) {
    if (p.dealer_id && p.whatsapp_phone) phoneMap[p.dealer_id] = p.whatsapp_phone;
  }

  // Faz 4: country/currency/payment ipucunu owner profilinden oku → bayiye
  // doğru para birimi + uygun ödeme yöntemiyle hatırlatma gider.
  const { currency, locale, payment } = await getOwnerLocaleAndPayment(ctx.userId);
  const paymentHint = paymentMethodHint(payment);

  let sent = 0;
  for (const d of debtDealers || []) {
    const phone = phoneMap[d.id];
    if (!phone) continue;

    try {
      await sendButtons(phone,
        `💳 *Ödeme Hatırlatması*\n\n` +
        `Sayın ${d.name},\n\n` +
        `Güncel bakiyeniz: *${formatCurrency(d.balance, currency, locale)}*\n\n` +
        `${paymentHint}\n\n` +
        `Detay için bakiyem komutu ile bakabilirsiniz.`,
        [
          { id: "cmd:bakiyem", title: "💰 Bakiyem" },
          { id: "cmd:mesajgonder", title: "✉️ Mesaj Gönder" },
        ],
      );
      sent++;
    } catch { /* skip */ }
  }

  await sendButtons(ctx.phone,
    `✅ Tahsilat hatırlatması gönderildi!\n📤 ${sent} bayiye iletildi`,
    [{ id: "cmd:menu", title: "Ana Menü" }],
  );
}

// ── /duyuru — Tüm bayilere serbest mesaj ────────────────────────────

export async function handleDuyuru(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin" && ctx.role !== "employee") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "duyuru", "waiting_message");
  await sendText(ctx.phone, "📢 *Bayi Duyurusu*\n\nTüm bayilere göndermek istediğiniz mesajı yazın:\n\n(\"iptal\" ile vazgeçin)");
}

export async function handleDuyuruStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen mesajınızı yazın:"); return; }

  await endSession(ctx.userId);

  const dealers = await getDealerPhones(ctx.userId);
  if (dealers.length === 0) {
    await sendButtons(ctx.phone, "Kayıtlı bayi yok.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  let sent = 0;
  for (const dealer of dealers) {
    try {
      await sendText(dealer.phone, `📢 *Duyuru*\n\nGönderen: ${ctx.userName}\n\n${text}`);
      sent++;
    } catch { /* skip */ }
  }

  await sendButtons(ctx.phone,
    `✅ Duyuru gönderildi!\n📤 ${sent}/${dealers.length} bayiye iletildi\n\n📝 ${text.substring(0, 100)}`,
    [{ id: "cmd:menu", title: "Ana Menü" }],
  );
}

// ── Sipariş bildirimi (dealer → firma) — called from dealer.ts ──────

export async function notifyOwnerNewOrder(
  ownerId: string,
  dealerName: string,
  orderSummary: string,
): Promise<void> {
  const supabase = getServiceClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("whatsapp_phone")
    .eq("id", ownerId)
    .single();

  if (owner?.whatsapp_phone) {
    await sendButtons(owner.whatsapp_phone,
      `📦 *Yeni Sipariş!*\n\n🏢 ${dealerName}\n\n${orderSummary}`,
      [
        { id: "cmd:siparisler", title: "📋 Siparişler" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  }
}
