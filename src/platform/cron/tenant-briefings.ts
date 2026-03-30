/**
 * Tenant-specific briefing, daily check, and weekly report implementations
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";
import { registerBriefing, registerDailyCheck, registerWeeklyReport } from "./briefing-registry";

// ── Emlak ──────────────────────────────────────────────────────────────

registerBriefing("emlak", async (userId) => {
  const supabase = getServiceClient();
  const { count: total } = await supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId);
  const { count: satilik } = await supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("listing_type", "satilik");
  const { count: kiralik } = await supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("listing_type", "kiralik");
  const { count: customers } = await supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId);
  const tomorrow = new Date(); tomorrow.setHours(tomorrow.getHours() + 24);
  const { count: reminders } = await supabase.from("reminders").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("triggered", false).lte("remind_at", tomorrow.toISOString());
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const { count: contracts } = await supabase.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "cancelled").lte("end_date", nextWeek.toISOString().slice(0, 10));

  return `📊 Günaydın! Günlük brifing:\n\n🏠 Portföy: ${total || 0} mülk (${satilik || 0} satılık, ${kiralik || 0} kiralık)\n👥 Müşteriler: ${customers || 0}\n⏰ Hatırlatmalar: ${reminders || 0}\n📋 Yaklaşan sözleşme: ${contracts || 0}\n\nİyi çalışmalar!`;
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

registerBriefing("bayi", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count: todayOrders } = await supabase.from("bayi_orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", `${today}T00:00:00`);
  const { data: todayOrdersData } = await supabase.from("bayi_orders").select("total_amount").eq("tenant_id", tenantId).gte("created_at", `${today}T00:00:00`);
  const revenue = (todayOrdersData || []).reduce((s, o) => s + (o.total_amount || 0), 0);
  const { count: criticalStock } = await supabase.from("bayi_products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true).lt("stock_quantity", 10);
  const { count: dealers } = await supabase.from("bayi_dealers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true);
  const fmt = new Intl.NumberFormat("tr-TR").format(revenue);

  return `📊 Günaydın! Bayi brifing:\n\n📦 Bugünkü siparişler: ${todayOrders || 0}\n💰 Günlük ciro: ₺${fmt}\n🔴 Kritik stok: ${criticalStock || 0} ürün\n👥 Aktif bayi: ${dealers || 0}\n\nİyi çalışmalar!`;
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

// ── Market ─────────────────────────────────────────────────────────────

registerBriefing("market", async (_userId, tenantId) => {
  const supabase = getServiceClient();
  const { count: products } = await supabase.from("market_products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const { count: lowStock } = await supabase.from("market_products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).lt("stock_quantity", 5);
  return `📊 Günaydın! Market brifing:\n\n🛒 Ürünler: ${products || 0}\n🔴 Düşük stok: ${lowStock || 0}\n\nİyi çalışmalar!`;
});
