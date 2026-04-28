/**
 * Tenant-specific briefing, daily check, and weekly report implementations
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendUrlButton } from "@/platform/whatsapp/send";
import { registerBriefing, registerDailyCheck, registerWeeklyReport } from "./briefing-registry";
import { randomBytes } from "crypto";

// ── Emlak — Daily Sahibi Lead Brief (link-only, kriter-filtreli) ──────
//
// Her sabah kullanıcının takip kriterlerine uyan bugünün yeni sahibi
// ilanlarını sahibinden.com linkleri ile birlikte WA'ya gönderir.
// Kullanıcı linke tıklar, kendi sahibinden oturumundan telefonu reveal
// edip arar. Biz telefon çekmiyoruz — IP block/anti-bot sorunu yok.

interface DailyLead {
  source_id: string;
  source_url: string;
  title: string;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_neighborhood: string | null;
}

interface TrackingCriteria {
  neighborhoods: string[];
  property_types: string[];
  listing_type: string | null;
  price_min: number | null;
  price_max: number | null;
}

// Kullanıcı kriter kaydetmemişse default preset: tüm Bodrum, daire+villa satılık
const DEFAULT_CRITERIA: TrackingCriteria = {
  neighborhoods: [],
  property_types: ["daire", "villa"],
  listing_type: "satilik",
  price_min: null,
  price_max: null,
};

function matchesCriteria(lead: DailyLead, c: TrackingCriteria): boolean {
  // Property type filter
  if (c.property_types.length > 0 && !c.property_types.includes(lead.type)) return false;

  // Listing type filter
  if (c.listing_type && lead.listing_type !== c.listing_type) return false;

  // Price range
  if (c.price_min && (lead.price || 0) < c.price_min) return false;
  if (c.price_max && (lead.price || 0) > c.price_max) return false;

  // Neighborhood — lead.location_neighborhood format: "SubArea / Mahalle Mh."
  // Kullanıcı "Yalıkavak" seçerse, "Yalıkavak / Geriş Mh." eşleşmeli.
  if (c.neighborhoods.length > 0) {
    const loc = (lead.location_neighborhood || "").toLocaleLowerCase("tr-TR");
    const match = c.neighborhoods.some(n => loc.includes(n.toLocaleLowerCase("tr-TR")));
    if (!match) return false;
  }

  return true;
}

function formatLead(lead: DailyLead, index: number): string {
  const priceStr = lead.price
    ? `${new Intl.NumberFormat("tr-TR").format(lead.price)} ₺`
    : "Fiyat belirtilmedi";
  const specParts = [
    lead.rooms,
    lead.area ? `${lead.area} m²` : null,
  ].filter(Boolean).join(" · ");
  const spec = specParts ? `${specParts} · ` : "";
  const loc = lead.location_neighborhood || "Bodrum";

  return `*${index}.* ${lead.title}\n📍 ${loc}\n${spec}💰 ${priceStr}\n🔗 ${lead.source_url}`;
}

registerBriefing("emlak", async (userId) => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_phone, display_name")
    .eq("id", userId).single();

  if (!profile?.whatsapp_phone) return "";
  const phone = profile.whatsapp_phone as string;
  const firstName = ((profile.display_name as string | null) || "").split(/\s+/)[0] || "Merhaba";

  // User criteria (or default)
  const { data: crit } = await supabase
    .from("emlak_tracking_criteria")
    .select("neighborhoods, property_types, listing_type, price_min, price_max, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  const criteria: TrackingCriteria = crit ? {
    neighborhoods: (crit.neighborhoods as string[]) || [],
    property_types: (crit.property_types as string[]) || [],
    listing_type: (crit.listing_type as string | null) || null,
    price_min: (crit.price_min as number | null) || null,
    price_max: (crit.price_max as number | null) || null,
  } : DEFAULT_CRITERIA;

  // Today's leads (Bodrum only — daily_leads may contain cross-Turkey rows
  // from sahibinden's "similar listings" fallback when a category has few
  // results; filter at query level to prevent leakage).
  const { data: leadsRaw } = await supabase
    .from("emlak_daily_leads")
    .select("source_id, source_url, title, type, listing_type, price, area, rooms, location_neighborhood")
    .eq("snapshot_date", today)
    .ilike("location_district", "%Bodrum%")
    .order("created_at", { ascending: true });

  const leads = (leadsRaw || []) as DailyLead[];

  if (leads.length === 0) {
    await sendText(phone, `🌅 Günaydın ${firstName}!\n\nBugün sahibinden'de yeni sahibi ilan çıkmamış. Yarın sabah tekrar 👋`);
    return "";
  }

  // Filter by criteria
  const matching = leads.filter(l => matchesCriteria(l, criteria));

  // Exclude already-seen (lead_calls has any action logged)
  const { data: calls } = await supabase
    .from("emlak_lead_calls")
    .select("source_id")
    .eq("user_id", userId);
  const seenIds = new Set((calls || []).map(c => c.source_id as string));
  const fresh = matching.filter(l => !seenIds.has(l.source_id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

  // Magic token for the takip page (user can always edit criteria)
  const takipToken = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: userId,
    token: takipToken,
    expires_at: expires,
  });
  const takipUrl = `${appUrl}/tr/takip?t=${takipToken}`;

  if (fresh.length === 0) {
    const msg = matching.length === 0
      ? `🌅 Günaydın ${firstName}!\n\nBugün ${leads.length} yeni sahibi ilan var ama senin kriterine uyanı yok. Kriterini genişletmek ister misin?`
      : `🌅 Günaydın ${firstName}!\n\nKriterine uyan ${matching.length} ilan var ama hepsini daha önce işaretlemişsin 💪`;
    await sendText(phone, msg);
    await sendUrlButton(phone, `🎯 Takip kriterini düzenle:`, "🎯 Kriterler", takipUrl, { skipNav: true });
    return "";
  }

  const criteriaSummary = [
    criteria.neighborhoods.length > 0 ? criteria.neighborhoods.join("+") : "Tüm Bodrum",
    criteria.property_types.length > 0 ? criteria.property_types.join("+") : "Tüm tipler",
    criteria.listing_type || "Sat+Kir",
  ].join(" · ");

  const header = `🌅 Günaydın ${firstName}!\n\nBugün kriterine (${criteriaSummary}) uyan *${fresh.length} yeni sahibi ilan* var. Linke tıkla, sahibinden'de telefonu gör, ara 👇\n`;
  const footer = `\n\n─────────\n_Linke tıklayınca sahibinden'deki ilanı görürsün, kendi hesabınla telefonu reveal edebilirsin._`;

  // Chunk if over 3500 chars
  const chunks: string[] = [];
  let current = header;
  fresh.forEach((lead, i) => {
    const block = `\n${formatLead(lead, i + 1)}\n`;
    if (current.length + block.length > 3500) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  });
  chunks.push(current + footer);

  for (const chunk of chunks) {
    await sendText(phone, chunk);
  }

  // Criteria edit button
  await sendUrlButton(
    phone,
    `🎯 Kriter değiştir veya genişlet:`,
    "🎯 Kriterler",
    takipUrl,
    { skipNav: true },
  );

  return "";
});

registerDailyCheck("emlak", async (userId, _tenantId, phone) => {
  const supabase = getServiceClient();
  let alerts = 0;
  const now = new Date();

  // Contract expiry
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const { data: contracts } = await supabase.from("contracts").select("id, contract_data, end_date").eq("user_id", userId).neq("status", "cancelled").gte("end_date", now.toISOString().slice(0, 10)).lte("end_date", nextWeek.toISOString().slice(0, 10));
  for (const c of contracts || []) {
    const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
    const title = (c.contract_data as Record<string, unknown>)?.property_title || "Mülk";
    await sendText(phone, `📋 Sözleşme uyarısı: ${title} sözleşmesi ${days} gün içinde doluyor.`);
    alerts++;
  }

  // Customer cooldown (14 days)
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const { data: cold } = await supabase.from("emlak_customers").select("name, updated_at").eq("user_id", userId).eq("status", "aktif").lt("updated_at", twoWeeksAgo.toISOString()).limit(3);
  for (const c of cold || []) {
    const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / 86400000);
    await sendText(phone, `👥 ${c.name} ile ${days} gündür iletişim yok.`);
    alerts++;
  }
  return alerts;
});

registerWeeklyReport("emlak", async (userId) => {
  const supabase = getServiceClient();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: newProps } = await supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo.toISOString());
  const { count: newCust } = await supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo.toISOString());
  const { data: props } = await supabase.from("emlak_properties").select("price").eq("user_id", userId);
  const totalValue = (props || []).reduce((s, p) => s + (typeof p.price === "number" ? p.price : 0), 0);
  const fmt = new Intl.NumberFormat("tr-TR").format(totalValue);

  return `📈 Haftalık Rapor\n\n🏠 Bu hafta eklenen mülk: ${newProps || 0}\n👥 Bu hafta eklenen müşteri: ${newCust || 0}\n💼 Toplam portföy: ${props?.length || 0} mülk\n💰 Toplam değer: ${fmt} TL\n\nBaşarılı bir hafta olsun!`;
});

// ── Site Yönetim ───────────────────────────────────────────────────────

registerBriefing("siteyonetim", async (userId, tenantId) => {
  const supabase = getServiceClient();
  const { data: building } = await supabase.from("sy_buildings").select("id, name").or(`manager_id.eq.${userId},tenant_id.eq.${tenantId}`).limit(1).maybeSingle();
  if (!building) return "📊 Günaydın! Henüz bir bina kaydınız yok.";

  const { count: unpaid } = await supabase.from("sy_dues_ledger").select("*", { count: "exact", head: true }).eq("building_id", building.id).eq("is_paid", false);
  const { data: unpaidRows } = await supabase.from("sy_dues_ledger").select("amount, paid_amount").eq("building_id", building.id).eq("is_paid", false);
  const totalDebt = (unpaidRows || []).reduce((s, d) => s + (d.amount - d.paid_amount), 0);
  const { count: openTickets } = await supabase.from("sy_maintenance_tickets").select("*", { count: "exact", head: true }).eq("building_id", building.id).eq("status", "acik");
  const { data: income } = await supabase.from("sy_income_expenses").select("type, amount_kurus").eq("building_id", building.id);
  let gelir = 0, gider = 0;
  for (const r of income || []) { if (r.type === "income") gelir += r.amount_kurus; else gider += r.amount_kurus; }

  return `📊 Günaydın! ${building.name} brifing:\n\n🏢 Borçlu daire: ${unpaid || 0}\n💰 Toplam borç: ${(totalDebt / 100).toFixed(2)} TL\n🔧 Açık arıza: ${openTickets || 0}\n📈 Gelir: ${(gelir / 100).toFixed(2)} TL\n📉 Gider: ${(gider / 100).toFixed(2)} TL\nNet: ${((gelir - gider) / 100).toFixed(2)} TL\n\nİyi çalışmalar!`;
});

registerDailyCheck("siteyonetim", async (userId, tenantId, phone) => {
  const supabase = getServiceClient();
  let alerts = 0;
  const { data: building } = await supabase.from("sy_buildings").select("id").or(`manager_id.eq.${userId},tenant_id.eq.${tenantId}`).limit(1).maybeSingle();
  if (!building) return 0;

  // Late dues (unpaid with late_charge > 0)
  const { data: lateDues } = await supabase.from("sy_dues_ledger").select("unit_id, amount, paid_amount, late_charge_kurus, sy_units!inner(unit_number)").eq("building_id", building.id).eq("is_paid", false).gt("late_charge_kurus", 0).limit(5);
  if (lateDues?.length) {
    const lines = lateDues.map((d: any) => `Daire ${d.sy_units?.unit_number}: ${((d.amount - d.paid_amount) / 100).toFixed(0)} TL`);
    await sendText(phone, `⚠️ Gecikmiş aidatlar:\n${lines.join("\n")}`);
    alerts++;
  }

  // Old open tickets (7+ days)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: oldTickets } = await supabase.from("sy_maintenance_tickets").select("category, description, created_at").eq("building_id", building.id).eq("status", "acik").lt("created_at", weekAgo.toISOString()).limit(3);
  for (const t of oldTickets || []) {
    const days = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
    await sendText(phone, `🔧 ${days} gündür açık arıza: ${t.category} — ${t.description.substring(0, 60)}`);
    alerts++;
  }
  return alerts;
});

registerWeeklyReport("siteyonetim", async (userId, tenantId) => {
  const supabase = getServiceClient();
  const { data: building } = await supabase.from("sy_buildings").select("id, name").or(`manager_id.eq.${userId},tenant_id.eq.${tenantId}`).limit(1).maybeSingle();
  if (!building) return "📈 Haftalık rapor: Bina kaydı bulunamadı.";

  const { count: unpaid } = await supabase.from("sy_dues_ledger").select("*", { count: "exact", head: true }).eq("building_id", building.id).eq("is_paid", false);
  const { count: open } = await supabase.from("sy_maintenance_tickets").select("*", { count: "exact", head: true }).eq("building_id", building.id).eq("status", "acik");
  const { count: residents } = await supabase.from("sy_residents").select("*", { count: "exact", head: true }).eq("building_id", building.id).eq("is_active", true);

  return `📈 Haftalık Rapor — ${building.name}\n\n🏢 Aktif sakin: ${residents || 0}\n💰 Borçlu daire: ${unpaid || 0}\n🔧 Açık arıza: ${open || 0}\n\nİyi haftalar!`;
});

// ── Bayi ───────────────────────────────────────────────────────────────
//
// Capability-scoped briefing. Every bayi user (owner, çalışan, dealer)
// gets UPU's morning message, but the content is filtered to the
// capabilities they actually have. Owner sees everything (wildcard),
// muhasebeci/depocu/lojistikçi/bayi each see the slice relevant to
// them. If a user has no capabilities, they still get a short hello
// so onboarding doesn't feel silent.

registerBriefing("bayi", async (userId, tenantId) => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));

  // Load this user's capabilities
  const { data: profile } = await supabase
    .from("profiles")
    .select("capabilities, dealer_id, role")
    .eq("id", userId)
    .single();
  const caps = (profile?.capabilities as string[] | null) || [];
  const has = (c: string) => caps.includes("*") || caps.includes(c);

  const sections: string[] = [];

  // — Owner / reports view: day's orders + revenue + critical stock + dealers —
  if (has("reports:view") || caps.includes("*")) {
    const { data: todayOrders } = await supabase
      .from("bayi_orders")
      .select("total_amount")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${today}T00:00:00`);
    const revenue = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);
    const { count: criticalStock } = await supabase
      .from("bayi_products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .lt("stock_quantity", 10);
    const { count: dealers } = await supabase
      .from("bayi_dealers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    sections.push(
      `📊 *Günlük özet*\n` +
      `• Sipariş: ${todayOrders?.length || 0} | Ciro: ₺${fmt(revenue)}\n` +
      `• Kritik stok: ${criticalStock || 0} ürün\n` +
      `• Aktif bayi: ${dealers || 0}`
    );
  }

  // — Depocu (stock:view, not owner): today's deliveries to prep + critical stock —
  if (has("stock:view") && !caps.includes("*")) {
    const { data: critical } = await supabase
      .from("bayi_products")
      .select("name, stock_quantity")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .lt("stock_quantity", 10)
      .order("stock_quantity", { ascending: true })
      .limit(5);
    const { count: prepCount } = await supabase
      .from("bayi_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "preparing"]);
    const lines: string[] = [`📦 *Depo özeti*`, `• Hazırlanacak sipariş: ${prepCount || 0}`];
    if (critical?.length) {
      lines.push(`• Kritik stoklar:`);
      for (const c of critical) lines.push(`  - ${c.name}: ${c.stock_quantity} adet`);
    }
    sections.push(lines.join("\n"));
  }

  // — Finance (invoices or payments, not owner): overdue + yesterday's payments —
  if ((has("finance:invoices") || has("finance:payments")) && !caps.includes("*")) {
    const { data: overdue } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, amount")
      .eq("tenant_id", tenantId)
      .eq("is_paid", false)
      .lt("due_date", now);
    const overdueTotal = (overdue || []).reduce((s, i) => s + (i.amount || 0), 0);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data: paidYesterday } = await supabase
      .from("bayi_dealer_transactions")
      .select("amount")
      .eq("tenant_id", tenantId)
      .eq("type", "payment")
      .gte("created_at", `${yesterday}T00:00:00`)
      .lt("created_at", `${today}T00:00:00`);
    const paidTotal = (paidYesterday || []).reduce((s, t) => s + (t.amount || 0), 0);
    sections.push(
      `💳 *Finans özeti*\n` +
      `• Vadesi geçen: ${overdue?.length || 0} fatura (₺${fmt(overdueTotal)})\n` +
      `• Dün gelen ödemeler: ₺${fmt(paidTotal)}`
    );
  }

  // — Lojistikçi (deliveries:view, not owner): today's delivery list —
  if (has("deliveries:view") && !caps.includes("*")) {
    const { count: shipped } = await supabase
      .from("bayi_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "shipped");
    const { data: delayed } = await supabase
      .from("bayi_orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "preparing")
      .lt("created_at", new Date(Date.now() - 3 * 86400000).toISOString());
    sections.push(
      `🚛 *Lojistik özeti*\n` +
      `• Yolda: ${shipped || 0}\n` +
      `• 3+ gün hazırlanıyor: ${delayed?.length || 0}`
    );
  }

  // — Dealer (FINANCE_BALANCE_OWN or role): own balance + active campaigns —
  const isDealer = profile?.role === "dealer" || has("finance:balance-own");
  if (isDealer && !caps.includes("*")) {
    let balance = 0;
    let dealerName = "";
    if (profile?.dealer_id) {
      const { data: d } = await supabase
        .from("bayi_dealers")
        .select("company_name, balance")
        .eq("id", profile.dealer_id)
        .maybeSingle();
      balance = Number(d?.balance || 0);
      dealerName = (d?.company_name as string) || "";
    }
    const { count: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .lte("start_date", now)
      .gte("end_date", now);
    const balLine = balance < 0
      ? `• Borç: ₺${fmt(Math.abs(balance))}`
      : balance > 0 ? `• Alacak: ₺${fmt(balance)}` : `• Bakiye: denk`;
    sections.push(
      `🏪 *${dealerName || "Bayi"} brifingi*\n` +
      `${balLine}\n` +
      `• Aktif kampanya: ${campaigns || 0}`
    );
  }

  if (sections.length === 0) {
    return `👋 Günaydın! Yapılacak bir uyarı yok. İyi çalışmalar!`;
  }

  return `🌅 *Günaydın!*\n\n${sections.join("\n\n")}\n\nİyi çalışmalar!`;
});

registerDailyCheck("bayi", async (_userId, tenantId, phone) => {
  const supabase = getServiceClient();
  let alerts = 0;

  // Critical stock
  const { data: critical } = await supabase.from("bayi_products").select("name, stock_quantity, low_stock_threshold").eq("tenant_id", tenantId).eq("is_active", true).lt("stock_quantity", 10).limit(5);
  if (critical?.length) {
    const lines = critical.map(p => `${p.name}: ${p.stock_quantity} adet`);
    await sendText(phone, `🔴 Kritik stok uyarısı:\n${lines.join("\n")}`);
    alerts++;
  }

  // Overdue payments
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await supabase.from("bayi_dealer_transactions").select("amount, description, due_date, bayi_dealers!inner(company_name)").eq("tenant_id", tenantId).lt("due_date", today).limit(5);
  if (overdue?.length) {
    const lines = overdue.map((t: any) => `${t.bayi_dealers?.company_name}: ₺${new Intl.NumberFormat("tr-TR").format(t.amount)}`);
    await sendText(phone, `⚠️ Vadesi geçmiş ödemeler:\n${lines.join("\n")}`);
    alerts++;
  }
  return alerts;
});

// ── Muhasebe ───────────────────────────────────────────────────────────

registerBriefing("muhasebe", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const { count: invoices } = await supabase.from("muhasebe_invoices").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const { count: clients } = await supabase.from("muhasebe_clients").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  return `📊 Günaydın! Muhasebe brifing:\n\n📄 Toplam fatura: ${invoices || 0}\n👥 Mükellef: ${clients || 0}\n\nİyi çalışmalar!`;
});

// ── Otel ───────────────────────────────────────────────────────────────

registerBriefing("otel", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count: checkins } = await supabase.from("otel_reservations").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("check_in_date", today);
  const { count: checkouts } = await supabase.from("otel_reservations").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("check_out_date", today);
  const { count: rooms } = await supabase.from("otel_rooms").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  return `📊 Günaydın! Otel brifing:\n\n🛎️ Bugün check-in: ${checkins || 0}\n🚪 Bugün check-out: ${checkouts || 0}\n🏨 Toplam oda: ${rooms || 0}\n\nİyi çalışmalar!`;
});

registerDailyCheck("otel", async (_userId, tenantId, phone) => {
  const supabase = getServiceClient();
  let alerts = 0;
  const today = new Date().toISOString().slice(0, 10);

  // Dirty rooms with check-in today
  const { data: dirtyRooms } = await supabase
    .from("otel_rooms")
    .select("room_number")
    .eq("tenant_id", tenantId)
    .eq("cleaning_status", "dirty")
    .limit(5);
  if (dirtyRooms?.length) {
    const rooms = dirtyRooms.map(r => `Oda ${r.room_number}`).join(", ");
    await sendText(phone, `🧹 Temizlenmemiş odalar: ${rooms}`);
    alerts++;
  }

  // Unanswered guest messages (2+ hours old)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count: unanswered } = await supabase
    .from("otel_guest_messages")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_answered", false)
    .lt("created_at", twoHoursAgo);
  if (unanswered && unanswered > 0) {
    await sendText(phone, `💬 ${unanswered} cevaplanmamış misafir mesajı (2+ saat)`);
    alerts++;
  }

  // Rooms under maintenance
  const { count: maintenance } = await supabase
    .from("otel_rooms")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "maintenance");
  if (maintenance && maintenance > 0) {
    await sendText(phone, `🔧 ${maintenance} oda bakımda`);
    alerts++;
  }

  return alerts;
});

registerWeeklyReport("otel", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: totalReservations } = await supabase
    .from("otel_reservations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", weekAgo.toISOString());

  const { count: totalRooms } = await supabase
    .from("otel_rooms")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { count: occupiedRooms } = await supabase
    .from("otel_reservations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "checked_in");

  const occupancy = (totalRooms || 0) > 0 ? Math.round(((occupiedRooms || 0) / (totalRooms || 1)) * 100) : 0;

  const { data: reviews } = await supabase
    .from("otel_guest_reviews")
    .select("rating")
    .eq("tenant_id", tenantId)
    .gte("created_at", weekAgo.toISOString());

  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "-";

  return `📈 Haftalık Otel Raporu\n\n📅 Bu hafta yeni rezervasyon: ${totalReservations || 0}\n🏨 Toplam oda: ${totalRooms || 0}\n📊 Anlık doluluk: %${occupancy}\n⭐ Ortalama puan: ${avgRating}/5 (${reviews?.length || 0} yorum)\n\nBaşarılı bir hafta olsun!`;
});

// ── Market ─────────────────────────────────────────────────────────────

registerBriefing("market", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const { count: products } = await supabase.from("market_products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const { count: lowStock } = await supabase.from("market_products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).lt("stock_quantity", 5);
  return `📊 Günaydın! Market brifing:\n\n🛒 Ürünler: ${products || 0}\n🔴 Düşük stok: ${lowStock || 0}\n\nİyi çalışmalar!`;
});
