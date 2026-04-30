/**
 * Conversational Dispatch — bayi tenant için "komutu anlamadım"
 * fallback'ından önce devreye giren AI handler.
 *
 * İki ana use-case:
 *   1. Bayi WA'dan "abi 5 koli boya" der → AI sipariş çıkarır →
 *      sahibe onay butonu sunar (extractOrderFromMessage)
 *   2. Sahip / çalışan WA'dan "stok ne durumda" der → AI cari sorulara
 *      kısa Türkçe cevap verir (handleFreeFormQuery)
 *
 * Faz 7 MVP: en görsel iki senaryoda iyi çalışan, scope dar.
 * Image/voice input, multi-turn dialog v2'ye atılı.
 *
 * Maliyet uyarısı: her free-text mesaj = Claude çağrısı (~$0.003-0.01).
 * Komut shortcut'ları öncelikli (router komutu önce dener); sadece
 * "anlamadım" durumunda buraya düşer.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons, sendText } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { askClaude } from "@/platform/ai/claude";
import { buildBayiUpuSystemPrompt } from "../persona/system-prompt";
import { formatCurrency, type SupportedCurrency, type SupportedLocale } from "@/platform/i18n/currency";

// ── Tip tanımları ────────────────────────────────────────────────────────

interface ProductCatalogItem {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  brand: string | null;
  category: string | null;
}

interface ExtractedOrderLine {
  product_id: string | null;   // null = AI eşleştiremedi, ürün yok
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  line_total: number | null;
}

interface ExtractedOrder {
  matched: boolean;
  lines: ExtractedOrderLine[];
  total: number;
  notes: string;
}

// ── Helper: owner / dealer profile context ──────────────────────────────

async function getProfileContext(userId: string): Promise<{
  role: string;
  country: string;
  currency: SupportedCurrency;
  locale: SupportedLocale;
  callerName: string | null;
  companyName: string | null;
  ownerId: string;            // dealer ise sahibinin id'si, owner ise kendi id'si
}> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, invited_by, metadata")
    .eq("id", userId)
    .maybeSingle();

  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const localeSettings = (meta.tenant_locale || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;

  // Ownership chain — dealer/employee'in sahibi
  let ownerId = profile?.id || userId;
  if (profile?.role === "dealer" || profile?.role === "employee") {
    if (profile.invited_by) ownerId = profile.invited_by as string;
  }

  // Lokalizasyon: dealer'sa sahibinin tenant_locale'ini al (dealer kendi
  // ayarlarından önce sahibinin para birimi/dilini görür)
  let currency = (localeSettings.currency as SupportedCurrency) || "EUR";
  let locale = (localeSettings.locale as SupportedLocale) || "tr-NL";
  let country = (localeSettings.country as string) || (firma.country as string) || "NL";
  if (ownerId !== profile?.id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", ownerId)
      .maybeSingle();
    const ownerMeta = (ownerProfile?.metadata || {}) as Record<string, unknown>;
    const ownerLocale = (ownerMeta.tenant_locale || {}) as Record<string, unknown>;
    const ownerFirma = (ownerMeta.firma_profili || {}) as Record<string, unknown>;
    if (ownerLocale.currency) currency = ownerLocale.currency as SupportedCurrency;
    if (ownerLocale.locale) locale = ownerLocale.locale as SupportedLocale;
    if (ownerLocale.country) country = ownerLocale.country as string;
    if (ownerFirma.country && !ownerLocale.country) country = ownerFirma.country as string;
  }

  return {
    role: profile?.role || "user",
    country,
    currency,
    locale,
    callerName: profile?.display_name || null,
    companyName: (firma.ticari_unvan as string) || (meta.company_name as string) || null,
    ownerId,
  };
}

// ── extract_order: bayi WA mesajından AI ile sipariş çıkarma ────────────

/**
 * Owner'ın ürün kataloğunu Claude'a injecte ederek bayinin WA
 * mesajından eşleşen ürünleri + miktarları çıkar.
 *
 * Çıktı: structured order. Eşleşmezse matched=false.
 */
export async function extractOrderFromMessage(
  text: string,
  catalog: ProductCatalogItem[],
): Promise<ExtractedOrder> {
  const catalogShort = catalog.slice(0, 50).map(p => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    price: p.unit_price,
  }));

  const systemPrompt = `Sen bir B2B sipariş asistanısın. Bayinin WhatsApp mesajından ürün siparişlerini structured JSON olarak çıkar.

Ürün kataloğu (kullanıcının firması bunu satıyor):
${JSON.stringify(catalogShort, null, 2)}

Cevap olarak SADECE şu JSON döndür (başka metin yok):
{
  "matched": true|false,
  "lines": [
    {"product_id": "uuid", "product_name": "...", "quantity": N, "unit": "...", "unit_price": N, "line_total": N}
  ],
  "total": N,
  "notes": "kısa açıklama"
}

Kurallar:
- Mesajdaki ürün ismini katalogla yakın eşleştir (Türkçe esnek match: "boya" → "Akzo Beyaz İç Cephe Mat 15L" gibi).
- Eşleşmediği ürün için product_id=null, line_total=null, notes'a yaz.
- Miktar yoksa quantity=1 varsay.
- Sayıyı yazıyla "beş" yerine 5 olarak çıkar.
- Hiçbir ürün eşleşmezse matched=false, lines boş array.`;

  const reply = await askClaude(systemPrompt, text, 800);
  try {
    // Claude bazen JSON dışına metin ekleyebilir; ilk JSON bloğunu çıkar
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { matched: false, lines: [], total: 0, notes: "AI yanıt vermedi" };
    const parsed = JSON.parse(jsonMatch[0]) as ExtractedOrder;
    return parsed;
  } catch {
    return { matched: false, lines: [], total: 0, notes: "AI yanıt parse edilemedi" };
  }
}

// ── handleFreeFormQuery: serbest soru → kısa Türkçe cevap ───────────────

/**
 * Sahip/çalışan WA'dan "stok ne durumda" / "bugün ne sattım" gibi
 * sorular sorduğunda kısa Türkçe cevap üretir. Domain context (today
 * orders/critical stock/dealers) prompt'a injecte edilir.
 *
 * Sınırları:
 *   - Yazma işlemi yapmaz (askClaude basit text-in/text-out)
 *   - Tool call yok (ileri faz Faz 7+'da askClaudeWithTools'a yükseltilir)
 *   - Multi-turn yok (her mesaj bağımsız)
 */
export async function handleFreeFormQuery(ctx: WaContext): Promise<boolean> {
  if (!ctx.text || ctx.text.length < 3) return false;
  if (ctx.text.length > 500) return false;       // çok uzun = emin değiliz

  const profileCtx = await getProfileContext(ctx.userId);
  const supabase = getServiceClient();

  // Tenant-scope context (owner'ın işiyle ilgili özet)
  const ownerId = profileCtx.ownerId;
  const today = new Date().toISOString().slice(0, 10);
  const [ordersToday, criticalStockRes, overdueRes, dealersRes] = await Promise.all([
    supabase.from("bayi_orders").select("total_amount").eq("user_id", ownerId).gte("created_at", `${today}T00:00:00`),
    supabase.from("bayi_products").select("name, stock_quantity").eq("user_id", ownerId).lt("stock_quantity", 10).limit(5),
    supabase.from("bayi_dealer_invoices").select("amount, due_date").eq("is_paid", false).lt("due_date", new Date().toISOString()),
    supabase.from("bayi_dealers").select("id", { count: "exact", head: true }).eq("user_id", ownerId).eq("is_active", true),
  ]);

  const orderCountToday = ordersToday.data?.length || 0;
  const revenueToday = (ordersToday.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);
  const overdueAmount = (overdueRes.data || []).reduce((s, i) => s + (i.amount || 0), 0);

  const personaPrompt = buildBayiUpuSystemPrompt({
    country: profileCtx.country,
    locale: profileCtx.locale,
    role: profileCtx.role,
    companyName: profileCtx.companyName || undefined,
    callerName: profileCtx.callerName || undefined,
  });

  const contextLine = `## Bugünün Özeti\n` +
    `- Bugün ${orderCountToday} sipariş, ciro ${formatCurrency(revenueToday, profileCtx.currency, profileCtx.locale)}\n` +
    `- Aktif bayi: ${dealersRes.count || 0}\n` +
    `- Vadesi geçen fatura: ${overdueRes.data?.length || 0}, toplam ${formatCurrency(overdueAmount, profileCtx.currency, profileCtx.locale)}\n` +
    (criticalStockRes.data?.length ? `- Kritik stok: ${criticalStockRes.data.map(p => `${p.name} (${p.stock_quantity})`).join(", ")}\n` : "");

  const fullSystem = personaPrompt + "\n\n" + contextLine + "\n\nKullanıcı sana WhatsApp mesajı gönderdi. Kısa, sıcak, somut Türkçe cevap ver. Maximum 3 cümle. Eylem önereceksen \"yapayım mı\" diye sor, kendi başına yapma.";

  const reply = await askClaude(fullSystem, ctx.text, 400);
  if (!reply || reply.trim().length === 0) return false;

  await sendButtons(ctx.phone, reply, [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
  return true;
}

// ── handleDealerOrderMessage: bayinin sipariş niyetli WA mesajı ────────

/**
 * Eğer ctx.role === "dealer" ise: bayi mesajını sipariş çıkarmaya
 * çalış. Eşleşmezse fallback'a düşmeden serbest soru handler'ına gider.
 *
 * Bayi user journey: "abi 5 koli akzo iç cephe" → AI ürünü buluyor →
 * "Akzo Beyaz İç Cephe Mat 15L 5 koli, 850 € — onaylıyor musun?"
 * butonu sunuluyor → bayi onay → sipariş kaydı + sahibe bildirim.
 */
export async function handleDealerOrderMessage(ctx: WaContext): Promise<boolean> {
  if (ctx.role !== "dealer") return false;
  if (!ctx.text || ctx.text.length < 3) return false;

  const profileCtx = await getProfileContext(ctx.userId);
  const supabase = getServiceClient();

  // Owner'ın aktif ürün kataloğunu çek (max 50)
  const { data: products } = await supabase
    .from("bayi_products")
    .select("id, name, unit, unit_price, brand, category")
    .eq("user_id", profileCtx.ownerId)
    .eq("is_active", true)
    .limit(50);

  if (!products || products.length === 0) return false;

  const extracted = await extractOrderFromMessage(ctx.text, products as ProductCatalogItem[]);
  if (!extracted.matched || extracted.lines.length === 0) return false;

  // Sadece eşleşen line'ları al
  const matchedLines = extracted.lines.filter(l => l.product_id && l.line_total !== null);
  if (matchedLines.length === 0) return false;

  const total = matchedLines.reduce((s, l) => s + (l.line_total || 0), 0);
  const lineSummary = matchedLines.map(l =>
    `• ${l.product_name} × ${l.quantity} ${l.unit} = ${formatCurrency(l.line_total || 0, profileCtx.currency, profileCtx.locale)}`
  ).join("\n");

  const summary = `📦 *Sipariş özeti*\n\n${lineSummary}\n\n*Toplam: ${formatCurrency(total, profileCtx.currency, profileCtx.locale)}*\n\nOnaylıyor musunuz?`;

  // Pending order'ı session'a kaydet — onaylanınca siparis_olustur'a çevir.
  // Bu commit'te basit text özet + butonlar; gerçek sipariş insert ileride
  // (siparis_olustur callback handler'ı zaten var — onunla bağlanacak).
  await sendButtons(ctx.phone, summary, [
    { id: "cmd:siparisver", title: "✅ Onayla, Sipariş Oluştur" },
    { id: "cmd:menu", title: "❌ İptal" },
  ]);

  // Sessizde sahibe upu hint mesajı atılabilir (Faz 7+); şimdilik no-op.
  return true;
}

// ── Main entry: router fallback'tan önce çağrılır ──────────────────────

/**
 * Bayi tenant'ı için conversational dispatch. Router komut/session/
 * callback hiçbiri match etmezse ve "Komutu anlamadım" fallback'ından
 * ÖNCE bu handler çağrılır. true döndürürse fallback kesilir.
 *
 * Sıralama:
 *   1. Dealer ise sipariş çıkarma dene → matched ise onay flow
 *   2. Aksi halde free-form query handler (kısa cevap)
 *   3. İkisi de match yapmazsa false → router "anlamadım" gösterir
 */
export async function handleBayiConversational(ctx: WaContext): Promise<boolean> {
  if (ctx.tenantKey !== "bayi") return false;
  if (!ctx.text) return false;

  // Performance: her serbest mesaj Claude maliyeti. Çok kısa veya tek
  // kelimelik mesajlarda agent çağırma (selam, merhaba gibi).
  const trimmed = ctx.text.trim();
  if (trimmed.length < 4) return false;

  try {
    // 1. Dealer message → order extraction
    if (ctx.role === "dealer") {
      const handled = await handleDealerOrderMessage(ctx);
      if (handled) return true;
    }

    // 2. Free-form query (sahip/çalışan ya da dealer eşleşmediyse)
    return await handleFreeFormQuery(ctx);
  } catch (err) {
    console.error("[bayi:conversational]", err);
    return false;
  }
}
