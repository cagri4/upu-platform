/**
 * UPU Agent — single consolidated assistant for the bayi tenant.
 *
 * Replaces the former 8 "virtual employees" (asistan, satisMuduru,
 * satisTemsilcisi, muhasebeci, tahsildar, depocu, lojistikci,
 * urunYoneticisi). Each of those had its own persona + its own tool
 * set; UPU is the union of all their tools, surfaced behind one brand.
 *
 * Menu filtering / capability checks happen at the WhatsApp command
 * layer (src/tenants/bayi/commands/index.ts), not here.
 */

import type {
  AgentContext,
  AgentDefinition,
  AgentProposal,
  AgentToolDefinition,
  ToolHandler,
  ToolResult,
} from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";
import { getRecentMessages, getTaskHistory } from "@/platform/agents/memory";
import { getAgentConfig } from "@/platform/agents/setup";
import { createProposalAndNotify, formatCurrency, formatDate } from "./helpers";
import { buildBayiUpuSystemPrompt } from "../persona/system-prompt";

// ── Tool Definitions (union of old 8 agent tools) ───────────────────────

const UPU_TOOLS: AgentToolDefinition[] = [
  // — summary / asistan —
  { name: "read_daily_summary", description: "Günlük sipariş, ciro, kritik stok, aktif teslimat özeti.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_dealer_overview", description: "Aktif bayi sayısı ve durum dağılımı.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_reminder", description: "Hatırlatma oluştur (onay gerektirir).", input_schema: { type: "object", properties: { title: { type: "string" }, remind_at: { type: "string" }, note: { type: "string" } }, required: ["title", "remind_at"] } },
  { name: "mark_task_done", description: "Görevi tamamlandı olarak işaretle (onay gerektirir).", input_schema: { type: "object", properties: { task_description: { type: "string" } }, required: ["task_description"] } },

  // — sales manager —
  { name: "read_campaigns", description: "Aktif kampanyaları oku.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_dealer_performance", description: "Bayi performans sıralaması (ciro, sipariş sayısı).", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_sales_targets", description: "Satış hedefleri ve gerçekleşme oranları.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_campaign_proposal", description: "Yeni kampanya önerisi (onay gerektirir).", input_schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" } }, required: ["name", "description", "start_date", "end_date"] } },
  { name: "flag_underperformer", description: "Düşük performanslı bayiyi işaretle (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, reason: { type: "string" } }, required: ["dealer_id", "dealer_name", "reason"] } },

  // — sales rep —
  { name: "read_planned_visits", description: "Önümüzdeki 7 gün bayi ziyaret planları.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_pending_orders", description: "Bekleyen siparişler.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_problem_dealers", description: "Sorunlu bayiler (negatif bakiyeli veya pasif).", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "schedule_visit", description: "Bayi ziyareti planla (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, visit_date: { type: "string" }, notes: { type: "string" } }, required: ["dealer_id", "dealer_name", "visit_date"] } },
  { name: "create_visit_note", description: "Ziyaret notu ekle (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, note: { type: "string" } }, required: ["dealer_id", "dealer_name", "note"] } },

  // — accountant —
  { name: "read_receivables", description: "Toplam alacak ve borçlu bayileri oku.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_overdue_invoices", description: "Vadesi geçmiş faturalar.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_recent_invoices", description: "Son 7 günün faturaları.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_dealer_statement", description: "Belirli bayinin hesap ekstresi.", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" } }, required: ["dealer_id", "dealer_name"] } },
  { name: "record_payment", description: "Ödeme kaydı oluştur (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, amount: { type: "number" }, note: { type: "string" } }, required: ["dealer_id", "dealer_name", "amount"] } },

  // — collector / tahsildar —
  { name: "read_due_today", description: "Bugün vadesi gelen faturalar.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_overdue", description: "Vadesi geçmiş faturalar (gecikme gün sayısıyla).", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_collection_activities", description: "Son tahsilat aktiviteleri.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_collection_record", description: "Tahsilat kaydı oluştur (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, amount: { type: "number" }, activity_type: { type: "string", enum: ["visit", "phone_call", "payment"] } }, required: ["dealer_id", "dealer_name", "amount", "activity_type"] } },
  { name: "send_payment_reminder", description: "Bayiye ödeme hatırlatması gönder (onay gerektirir).", input_schema: { type: "object", properties: { dealer_id: { type: "string" }, dealer_name: { type: "string" }, dealer_phone: { type: "string" }, overdue_amount: { type: "number" } }, required: ["dealer_id", "dealer_name", "dealer_phone", "overdue_amount"] } },

  // — warehouse / depocu —
  { name: "read_stock_status", description: "Stok durumu (kritik veya tüm ürünler).", input_schema: { type: "object", properties: { filter: { type: "string", enum: ["critical", "all"] } }, required: [] } },
  { name: "read_stock_movements", description: "Son stok hareketleri.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_pending_purchases", description: "Bekleyen satın alma siparişleri.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_purchase_request", description: "Satın alma talebi oluştur (onay gerektirir).", input_schema: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" }, quantity: { type: "number" }, note: { type: "string" } }, required: ["product_id", "product_name", "quantity"] } },
  { name: "flag_critical_stock", description: "Kritik stok uyarısı oluştur (onay gerektirir).", input_schema: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" }, current_quantity: { type: "number" }, min_stock: { type: "number" } }, required: ["product_id", "product_name", "current_quantity", "min_stock"] } },

  // — logistics —
  { name: "read_pending_deliveries", description: "Yoldaki teslimatlar (gönderilmiş siparişler).", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_today_deliveries", description: "Bugün teslim edilecek siparişler.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "read_delayed_shipments", description: "Geciken sevkiyatlar.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "update_order_status", description: "Sipariş durumunu güncelle (onay gerektirir).", input_schema: { type: "object", properties: { order_id: { type: "string" }, new_status: { type: "string", enum: ["preparing", "shipped", "delivered"] }, note: { type: "string" } }, required: ["order_id", "new_status"] } },
  { name: "create_delivery_note", description: "Teslimat notu oluştur (onay gerektirir).", input_schema: { type: "object", properties: { order_id: { type: "string" }, note: { type: "string" } }, required: ["order_id", "note"] } },

  // — product manager —
  { name: "read_products", description: "Ürün kataloğu. filter: all | inactive | no_price | slow_movers", input_schema: { type: "object", properties: { filter: { type: "string", enum: ["all", "inactive", "no_price", "slow_movers"] } }, required: [] } },
  { name: "read_product_stats", description: "Ürün istatistikleri.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "update_product_price", description: "Ürün fiyatını güncelle (onay gerektirir).", input_schema: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" }, new_price: { type: "number" }, reason: { type: "string" } }, required: ["product_id", "product_name", "new_price"] } },
  { name: "toggle_product_status", description: "Ürünü aktif/pasif yap (onay gerektirir).", input_schema: { type: "object", properties: { product_id: { type: "string" }, product_name: { type: "string" }, new_status: { type: "boolean" } }, required: ["product_id", "product_name", "new_status"] } },

  // — cross-cutting —
  { name: "draft_message", description: "Bir kişiye taslak WhatsApp mesajı hazırla (onay gerektirir).", input_schema: { type: "object", properties: { customer_name: { type: "string" }, customer_phone: { type: "string" }, message_text: { type: "string" } }, required: ["customer_name", "customer_phone", "message_text"] } },
];

// ── READ tool handlers ─────────────────────────────────────────────────

async function readDailySummary(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: orders } = await supabase.from("bayi_orders").select("id, total_amount").eq("tenant_id", ctx.tenantId).gte("created_at", `${today}T00:00:00`);
  const revenue = (orders || []).reduce((s, o) => s + (o.total_amount || 0), 0);
  const { count: crit } = await supabase.from("bayi_products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).lt("stock_quantity", 10);
  const { count: active } = await supabase.from("bayi_orders").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).in("status", ["shipped", "preparing"]);
  return {
    result: `Günlük özet (${today})\n- Sipariş: ${orders?.length || 0}\n- Ciro: ${formatCurrency(revenue)}\n- Kritik stok: ${crit || 0} ürün\n- Aktif teslimat: ${active || 0}`,
    needsApproval: false,
  };
}

async function readDealerOverview(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data: dealers } = await supabase.from("bayi_dealers").select("id, is_active").eq("tenant_id", ctx.tenantId);
  if (!dealers?.length) return { result: "Kayıtlı bayi yok.", needsApproval: false };
  const active = dealers.filter((d) => d.is_active).length;
  return { result: `Bayi durumu\n- Toplam: ${dealers.length}\n- Aktif: ${active}\n- Pasif: ${dealers.length - active}`, needsApproval: false };
}

async function readCampaigns(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const { data } = await supabase.from("bayi_campaigns").select("id, name, start_date, end_date").eq("tenant_id", ctx.tenantId).lte("start_date", now).gte("end_date", now);
  if (!data?.length) return { result: "Aktif kampanya yok.", needsApproval: false };
  return { result: data.map((c) => `- [${c.id}] ${c.name} | ${formatDate(c.start_date)} – ${formatDate(c.end_date)}`).join("\n"), needsApproval: false };
}

async function readDealerPerformance(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data: orders } = await supabase.from("bayi_orders").select("dealer_id, total_amount").eq("tenant_id", ctx.tenantId);
  if (!orders?.length) return { result: "Sipariş verisi yok.", needsApproval: false };
  const totals: Record<string, { total: number; count: number }> = {};
  for (const o of orders) {
    if (o.dealer_id) {
      if (!totals[o.dealer_id]) totals[o.dealer_id] = { total: 0, count: 0 };
      totals[o.dealer_id].total += o.total_amount || 0;
      totals[o.dealer_id].count += 1;
    }
  }
  const ids = Object.keys(totals);
  const { data: dealers } = await supabase.from("bayi_dealers").select("id, company_name").in("id", ids);
  const nm: Record<string, string> = {};
  for (const d of dealers || []) nm[d.id as string] = d.company_name as string;
  const sorted = Object.entries(totals).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  return { result: sorted.map(([id, s], i) => `${i + 1}. ${nm[id] || id} | ${formatCurrency(s.total)} | ${s.count} sipariş`).join("\n"), needsApproval: false };
}

async function readSalesTargets(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_sales_targets").select("period, target_amount, actual_amount").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(3);
  if (!data?.length) return { result: "Satış hedefi kaydı yok.", needsApproval: false };
  return { result: data.map((t) => `- ${t.period} | Hedef: ${formatCurrency(t.target_amount || 0)} | Gerçekleşen: ${formatCurrency(t.actual_amount || 0)} | %${t.target_amount ? Math.round(((t.actual_amount || 0) / t.target_amount) * 100) : 0}`).join("\n"), needsApproval: false };
}

async function readPlannedVisits(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const plus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase.from("bayi_dealer_visits").select("id, visit_date, notes, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).gte("visit_date", today).lte("visit_date", plus7).order("visit_date", { ascending: true });
  if (!data?.length) return { result: "Planlı ziyaret yok.", needsApproval: false };
  return { result: data.map((v) => `- ${formatDate(v.visit_date)} | ${(v.bayi_dealers as unknown as { company_name: string })?.company_name || "?"}${v.notes ? ` | ${v.notes}` : ""}`).join("\n"), needsApproval: false };
}

async function readPendingOrders(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_orders").select("id, total_amount, status, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).in("status", ["pending", "preparing"]).order("created_at", { ascending: false }).limit(15);
  if (!data?.length) return { result: "Bekleyen sipariş yok.", needsApproval: false };
  return { result: data.map((o) => `- [${o.id}] ${(o.bayi_dealers as unknown as { company_name: string })?.company_name || "?"} | ${formatCurrency(o.total_amount || 0)} | ${o.status}`).join("\n"), needsApproval: false };
}

async function readProblemDealers(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data: negative } = await supabase.from("bayi_dealers").select("id, company_name, balance").eq("tenant_id", ctx.tenantId).lt("balance", 0).limit(10);
  const { data: inactive } = await supabase.from("bayi_dealers").select("id, company_name").eq("tenant_id", ctx.tenantId).eq("is_active", false).limit(10);
  const lines: string[] = [];
  for (const d of negative || []) lines.push(`- [${d.id}] ${d.company_name} | ${formatCurrency(Math.abs(d.balance))} alacak`);
  for (const d of inactive || []) lines.push(`- [${d.id}] ${d.company_name} | pasif`);
  return { result: lines.length ? lines.join("\n") : "Sorunlu bayi yok.", needsApproval: false };
}

async function readReceivables(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data: debt } = await supabase.from("bayi_dealers").select("id, company_name, balance").eq("tenant_id", ctx.tenantId).lt("balance", 0).order("balance", { ascending: true });
  if (!debt?.length) return { result: "Borçlu bayi yok.", needsApproval: false };
  const total = debt.reduce((s, d) => s + Math.abs(d.balance || 0), 0);
  return { result: `Toplam alacak: ${formatCurrency(total)} (${debt.length} bayi)\n\n${debt.map((d) => `- [${d.id}] ${d.company_name} | ${formatCurrency(Math.abs(d.balance))}`).join("\n")}`, needsApproval: false };
}

async function readOverdueInvoices(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const { data } = await supabase.from("bayi_dealer_invoices").select("id, amount, due_date, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).eq("is_paid", false).lt("due_date", now).order("due_date", { ascending: true });
  if (!data?.length) return { result: "Vadesi geçmiş fatura yok.", needsApproval: false };
  return {
    result: data.map((inv) => {
      const days = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
      const nm = (inv.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${inv.id}] ${nm} | ${formatCurrency(inv.amount)} | ${days} gün gecikti`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readRecentInvoices(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await supabase.from("bayi_dealer_invoices").select("id, amount, due_date, is_paid, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).gte("created_at", week).order("created_at", { ascending: false }).limit(15);
  if (!data?.length) return { result: "Son 7 günde fatura yok.", needsApproval: false };
  return {
    result: data.map((inv) => {
      const nm = (inv.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${inv.id}] ${nm} | ${formatCurrency(inv.amount)} | ${inv.is_paid ? "Ödendi" : "Ödenmedi"}`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readDealerStatement(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_dealer_transactions").select("type, amount, note, created_at").eq("tenant_id", ctx.tenantId).eq("dealer_id", input.dealer_id).order("created_at", { ascending: false }).limit(20);
  if (!data?.length) return { result: `${input.dealer_name} için işlem kaydı yok.`, needsApproval: false };
  return { result: data.map((t) => `- ${formatDate(t.created_at)} | ${t.type} | ${formatCurrency(t.amount)}${t.note ? ` | ${t.note}` : ""}`).join("\n"), needsApproval: false };
}

async function readDueToday(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("bayi_dealer_invoices").select("id, amount, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).eq("is_paid", false).gte("due_date", `${today}T00:00:00`).lt("due_date", `${today}T23:59:59`);
  if (!data?.length) return { result: "Bugün vadesi gelen fatura yok.", needsApproval: false };
  return {
    result: data.map((inv) => {
      const nm = (inv.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${inv.id}] ${nm} | ${formatCurrency(inv.amount)}`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readCollectionActivities(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_collection_activities").select("activity_type, amount, created_at, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(10);
  if (!data?.length) return { result: "Tahsilat aktivitesi yok.", needsApproval: false };
  return {
    result: data.map((a) => {
      const nm = (a.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- ${formatDate(a.created_at)} | ${nm} | ${a.activity_type} | ${formatCurrency(a.amount || 0)}`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readStockStatus(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const filter = (input.filter as string) || "critical";
  let q = supabase.from("bayi_products").select("id, name, stock_quantity, min_stock").eq("tenant_id", ctx.tenantId);
  if (filter === "critical") q = q.lt("stock_quantity", 10);
  const { data } = await q.order("stock_quantity", { ascending: true }).limit(20);
  if (!data?.length) return { result: "Kayıt yok.", needsApproval: false };
  return { result: data.map((p) => `- [${p.id}] ${p.name} | stok: ${p.stock_quantity}${p.min_stock ? ` | min: ${p.min_stock}` : ""}`).join("\n"), needsApproval: false };
}

async function readStockMovements(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_order_items").select("quantity, unit_price, created_at, bayi_products(name)").order("created_at", { ascending: false }).limit(15);
  if (!data?.length) return { result: "Stok hareketi yok.", needsApproval: false };
  return {
    result: data.map((m) => {
      const nm = (m.bayi_products as unknown as { name: string })?.name || "?";
      return `- ${formatDate(m.created_at)} | ${nm} | ${m.quantity} adet`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readPendingPurchases(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_purchase_orders").select("id, supplier_id, total_amount, created_at").eq("tenant_id", ctx.tenantId).eq("status", "pending");
  if (!data?.length) return { result: "Bekleyen satın alma siparişi yok.", needsApproval: false };
  return { result: data.map((po) => `- [${po.id}] Tedarikçi: ${po.supplier_id || "?"} | ${formatCurrency(po.total_amount || 0)} | ${formatDate(po.created_at)}`).join("\n"), needsApproval: false };
}

async function readPendingDeliveries(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("bayi_orders").select("id, total_amount, created_at, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).eq("status", "shipped").order("created_at", { ascending: true }).limit(15);
  if (!data?.length) return { result: "Yoldaki teslimat yok.", needsApproval: false };
  return {
    result: data.map((o) => {
      const nm = (o.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${o.id}] ${nm} | ${formatCurrency(o.total_amount || 0)}`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readTodayDeliveries(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("bayi_orders").select("id, total_amount, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).in("status", ["shipped", "preparing"]).gte("delivery_date", `${today}T00:00:00`).lt("delivery_date", `${today}T23:59:59`);
  if (!data?.length) return { result: "Bugün planlanmış teslimat yok.", needsApproval: false };
  return {
    result: data.map((o) => {
      const nm = (o.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${o.id}] ${nm} | ${formatCurrency(o.total_amount || 0)}`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readDelayedShipments(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const threeDays = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data } = await supabase.from("bayi_orders").select("id, total_amount, created_at, bayi_dealers(company_name)").eq("tenant_id", ctx.tenantId).eq("status", "preparing").lt("created_at", threeDays);
  if (!data?.length) return { result: "Geciken sevkiyat yok.", needsApproval: false };
  return {
    result: data.map((o) => {
      const days = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000);
      const nm = (o.bayi_dealers as unknown as { company_name: string })?.company_name || "?";
      return `- [${o.id}] ${nm} | ${formatCurrency(o.total_amount || 0)} | ${days} gün hazırlanıyor`;
    }).join("\n"),
    needsApproval: false,
  };
}

async function readProducts(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const filter = (input.filter as string) || "all";
  let q = supabase.from("bayi_products").select("id, name, unit_price, base_price, stock_quantity, is_active").eq("tenant_id", ctx.tenantId);
  if (filter === "inactive") q = q.eq("is_active", false);
  else if (filter === "no_price") q = q.or("unit_price.is.null,unit_price.eq.0");
  const { data } = await q.limit(20);
  if (!data?.length) return { result: "Ürün yok.", needsApproval: false };
  return { result: data.map((p) => `- [${p.id}] ${p.name} | ${formatCurrency(p.unit_price || p.base_price || 0)} | stok: ${p.stock_quantity}${p.is_active ? "" : " | PASİF"}`).join("\n"), needsApproval: false };
}

async function readProductStats(_i: Record<string, unknown>, ctx: AgentContext): Promise<ToolResult> {
  const supabase = getServiceClient();
  const { count: total } = await supabase.from("bayi_products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId);
  const { count: inactive } = await supabase.from("bayi_products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("is_active", false);
  const { count: critical } = await supabase.from("bayi_products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).lt("stock_quantity", 10);
  return { result: `Ürün istatistikleri\n- Toplam: ${total || 0}\n- Pasif: ${inactive || 0}\n- Kritik stok: ${critical || 0}`, needsApproval: false };
}

// ── ACTION (proposal) tool handlers ─────────────────────────────────────
// Each creates a proposal + notifies the user for approval. Execution
// happens in the execute() dispatcher below once the user taps approve.

function mk(actionType: string, buttonLabel: string, ctx: AgentContext, taskId: string, agentName: string, agentIcon: string, actionData: Record<string, unknown>, message: string) {
  return createProposalAndNotify({ ctx, taskId, agentName, agentIcon, agentKey: "bayi_upu", actionType, actionData, message, buttonLabel });
}

const createReminder: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_reminder", "✅ Oluştur", ctx, taskId, n, i,
    { title: input.title, remind_at: input.remind_at, note: input.note || null },
    `Hatırlatma oluşturulsun mu?\n\n${input.title}\n${formatDate(input.remind_at as string)}${input.note ? `\n${input.note}` : ""}`);

const markTaskDone: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("mark_task_done", "✅ Tamamla", ctx, taskId, n, i,
    { task_description: input.task_description },
    `"${input.task_description}" görevi tamamlandı olarak işaretlensin mi?`);

const createCampaignProposal: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_campaign", "✅ Oluştur", ctx, taskId, n, i,
    { name: input.name, description: input.description, start_date: input.start_date, end_date: input.end_date },
    `📢 *Yeni Kampanya Önerisi*\n\n📋 ${input.name}\n📝 ${input.description}\n📅 ${formatDate(input.start_date as string)} – ${formatDate(input.end_date as string)}`);

const flagUnderperformer: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("flag_underperformer", "✅ İşaretle", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, reason: input.reason },
    `⚠️ *Düşük Performans Uyarısı*\n\n🏪 ${input.dealer_name}\n📉 ${input.reason}`);

const scheduleVisit: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("schedule_visit", "✅ Planla", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, visit_date: input.visit_date, notes: input.notes || null },
    `${input.dealer_name} ziyareti ${formatDate(input.visit_date as string)} için planlansın mı?${input.notes ? `\n📝 ${input.notes}` : ""}`);

const createVisitNote: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_visit_note", "✅ Ekle", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, note: input.note },
    `${input.dealer_name} için ziyaret notu eklensin mi?\n\n${input.note}`);

const recordPayment: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("record_payment", "✅ Kaydet", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, amount: input.amount, note: input.note || null },
    `${input.dealer_name} için ${formatCurrency(input.amount as number)} ödeme kaydedilsin mi?${input.note ? `\n📝 ${input.note}` : ""}`);

const createCollectionRecord: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_collection_record", "✅ Kaydet", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, amount: input.amount, activity_type: input.activity_type },
    `${input.dealer_name} için tahsilat kaydı (${input.activity_type}, ${formatCurrency(input.amount as number)}) oluşturulsun mu?`);

const sendPaymentReminder: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("send_payment_reminder", "✅ Gönder", ctx, taskId, n, i,
    { dealer_id: input.dealer_id, dealer_name: input.dealer_name, dealer_phone: input.dealer_phone, overdue_amount: input.overdue_amount },
    `${input.dealer_name} kişisine ${formatCurrency(input.overdue_amount as number)} için ödeme hatırlatması gönderilsin mi?`);

const createPurchaseRequest: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_purchase_request", "✅ Oluştur", ctx, taskId, n, i,
    { product_id: input.product_id, product_name: input.product_name, quantity: input.quantity, note: input.note || null },
    `"${input.product_name}" için ${input.quantity} adet satın alma talebi oluşturulsun mu?${input.note ? `\n📝 ${input.note}` : ""}`);

const flagCriticalStock: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("flag_critical_stock", "✅ Uyarı Oluştur", ctx, taskId, n, i,
    { product_id: input.product_id, product_name: input.product_name, current_quantity: input.current_quantity, min_stock: input.min_stock },
    `⚠️ "${input.product_name}" kritik stok seviyesinde!\nMevcut: ${input.current_quantity} | Min: ${input.min_stock}\nUyarı oluşturulsun mu?`);

const updateOrderStatus: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("update_order_status", "✅ Güncelle", ctx, taskId, n, i,
    { order_id: input.order_id, new_status: input.new_status, note: input.note || null },
    `Sipariş [${input.order_id}] durumu "${input.new_status}" olarak güncellensin mi?${input.note ? `\n📝 ${input.note}` : ""}`);

const createDeliveryNote: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("create_delivery_note", "✅ Kaydet", ctx, taskId, n, i,
    { order_id: input.order_id, note: input.note },
    `Sipariş [${input.order_id}] için teslimat notu kaydedilsin mi?\n\n${input.note}`);

const updateProductPrice: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("update_product_price", "✅ Güncelle", ctx, taskId, n, i,
    { product_id: input.product_id, product_name: input.product_name, new_price: input.new_price },
    `"${input.product_name}" fiyatı ${formatCurrency(input.new_price as number)} olarak güncellensin mi?${input.reason ? `\n📝 ${input.reason}` : ""}`);

const toggleProductStatus: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("toggle_product_status", "✅ Değiştir", ctx, taskId, n, i,
    { product_id: input.product_id, product_name: input.product_name, new_status: input.new_status },
    `"${input.product_name}" ürünü ${input.new_status ? "aktif" : "pasif"} yapılsın mı?`);

const draftMessage: ToolHandler = (input, ctx, taskId, n, i) =>
  mk("send_whatsapp", "✅ Gönder", ctx, taskId, n, i,
    { phone: input.customer_phone, message: input.message_text },
    `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`);

const upuToolHandlers: Record<string, ToolHandler> = {
  read_daily_summary: (i, c) => readDailySummary(i, c),
  read_dealer_overview: (i, c) => readDealerOverview(i, c),
  read_campaigns: (i, c) => readCampaigns(i, c),
  read_dealer_performance: (i, c) => readDealerPerformance(i, c),
  read_sales_targets: (i, c) => readSalesTargets(i, c),
  read_planned_visits: (i, c) => readPlannedVisits(i, c),
  read_pending_orders: (i, c) => readPendingOrders(i, c),
  read_problem_dealers: (i, c) => readProblemDealers(i, c),
  read_receivables: (i, c) => readReceivables(i, c),
  read_overdue_invoices: (i, c) => readOverdueInvoices(i, c),
  read_recent_invoices: (i, c) => readRecentInvoices(i, c),
  read_dealer_statement: (i, c) => readDealerStatement(i, c),
  read_due_today: (i, c) => readDueToday(i, c),
  read_overdue: (i, c) => readOverdueInvoices(i, c), // alias
  read_collection_activities: (i, c) => readCollectionActivities(i, c),
  read_stock_status: (i, c) => readStockStatus(i, c),
  read_stock_movements: (i, c) => readStockMovements(i, c),
  read_pending_purchases: (i, c) => readPendingPurchases(i, c),
  read_pending_deliveries: (i, c) => readPendingDeliveries(i, c),
  read_today_deliveries: (i, c) => readTodayDeliveries(i, c),
  read_delayed_shipments: (i, c) => readDelayedShipments(i, c),
  read_products: (i, c) => readProducts(i, c),
  read_product_stats: (i, c) => readProductStats(i, c),
  create_reminder: createReminder,
  mark_task_done: markTaskDone,
  create_campaign_proposal: createCampaignProposal,
  flag_underperformer: flagUnderperformer,
  schedule_visit: scheduleVisit,
  create_visit_note: createVisitNote,
  record_payment: recordPayment,
  create_collection_record: createCollectionRecord,
  send_payment_reminder: sendPaymentReminder,
  create_purchase_request: createPurchaseRequest,
  flag_critical_stock: flagCriticalStock,
  update_order_status: updateOrderStatus,
  create_delivery_note: createDeliveryNote,
  update_product_price: updateProductPrice,
  toggle_product_status: toggleProductStatus,
  draft_message: draftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const bayiUpuAgent: AgentDefinition = {
  key: "bayi_upu",
  name: "UPU",
  icon: "🤖",
  tools: UPU_TOOLS,
  toolHandlers: upuToolHandlers,

  // upu persona (Faz 2): src/tenants/bayi/persona/system-prompt.ts
  // buildBayiUpuSystemPrompt(opts) helper'ı ile pozisyon-aware ton üretilir.
  // Cron task'ta opts boş geçince varsayılan owner tonu uygulanır; ileride
  // ctx.role + profile.country/locale ile zenginleştirilecek (Faz 7).
  systemPrompt: buildBayiUpuSystemPrompt(),

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_upu");
    const today = new Date().toISOString().slice(0, 10);

    const [ordersRes, stockRes, deliveriesRes, dealersRes, debtRes, overdueRes, lowStockRes] = await Promise.all([
      supabase.from("bayi_orders").select("id, total_amount").eq("tenant_id", ctx.tenantId).gte("created_at", `${today}T00:00:00`),
      supabase.from("bayi_products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).lt("stock_quantity", 10),
      supabase.from("bayi_orders").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).in("status", ["shipped", "preparing"]),
      supabase.from("bayi_dealers").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("is_active", true),
      supabase.from("bayi_dealers").select("id, balance").eq("tenant_id", ctx.tenantId).lt("balance", 0),
      supabase.from("bayi_dealer_invoices").select("id").eq("tenant_id", ctx.tenantId).eq("is_paid", false).lt("due_date", new Date().toISOString()),
      supabase.from("bayi_products").select("id, name, stock_quantity").eq("tenant_id", ctx.tenantId).lt("stock_quantity", 10).order("stock_quantity", { ascending: true }).limit(5),
    ]);

    const orderCount = ordersRes.data?.length || 0;
    const revenue = (ordersRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalReceivables = (debtRes.data || []).reduce((s, d) => s + Math.abs(d.balance || 0), 0);

    const recentMessages = await getRecentMessages(ctx.userId, "bayi_upu", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_upu", 5);

    return {
      orderCount,
      revenue,
      criticalStockCount: stockRes.count || 0,
      activeDeliveries: deliveriesRes.count || 0,
      dealerCount: dealersRes.count || 0,
      totalReceivables,
      debtDealerCount: debtRes.data?.length || 0,
      overdueCount: overdueRes.data?.length || 0,
      lowStockItems: lowStockRes.data || [],
      agentConfig: config,
      recentDecisions: taskHistory.filter((t) => t.status === "done" && t.execution_log?.length).slice(0, 3).map((t) => ({
        date: t.created_at,
        actions: (t.execution_log || []).map((l) => `${l.action}: ${l.status}`),
      })),
      messageHistory: recentMessages.slice(-5).map((m) => ({ role: m.role, content: m.content.substring(0, 200) })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const {
      orderCount, revenue, criticalStockCount, activeDeliveries, dealerCount,
      totalReceivables, debtDealerCount, overdueCount, lowStockItems,
      recentDecisions, messageHistory,
    } = data as {
      orderCount: number; revenue: number; criticalStockCount: number;
      activeDeliveries: number; dealerCount: number; totalReceivables: number;
      debtDealerCount: number; overdueCount: number;
      lowStockItems: Array<{ id: string; name: string; stock_quantity: number }>;
      recentDecisions: Array<{ date: string; actions: string[] }>;
      messageHistory: Array<{ role: string; content: string }>;
    };

    if (orderCount === 0 && criticalStockCount === 0 && activeDeliveries === 0 && dealerCount === 0 && overdueCount === 0) return "";

    let prompt = `## Mevcut Durum\nTarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    prompt += `### Günlük Özet\n`;
    prompt += `- Sipariş: ${orderCount} | Ciro: ${formatCurrency(revenue)}\n`;
    prompt += `- Aktif teslimat: ${activeDeliveries} | Aktif bayi: ${dealerCount}\n`;
    prompt += `- Kritik stok: ${criticalStockCount} ürün\n`;
    if (overdueCount) prompt += `- Vadesi geçen fatura: ${overdueCount}\n`;
    if (totalReceivables) prompt += `- Toplam alacak: ${formatCurrency(totalReceivables)} (${debtDealerCount} bayi)\n`;

    if (lowStockItems?.length) {
      prompt += `\n### Kritik Stok Ürünleri\n`;
      for (const p of lowStockItems) prompt += `- [${p.id}] ${p.name} | stok: ${p.stock_quantity}\n`;
    }

    if (recentDecisions?.length) {
      prompt += `\n### Son Kararlar\n`;
      for (const d of recentDecisions) {
        prompt += `- ${new Date(d.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}: ${d.actions.join(", ")}\n`;
      }
    }

    if (messageHistory?.length) {
      prompt += `\n### Son Mesajlar\n`;
      for (const m of messageHistory) prompt += `[${m.role}] ${m.content}\n`;
    }

    return prompt;
  },

  parseProposals(aiResponse: string): AgentProposal[] {
    try {
      const match = aiResponse.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const arr = JSON.parse(match[0]);
      if (!Array.isArray(arr)) return [];
      return arr.map((item: { type: string; message: string; priority?: string; data?: Record<string, unknown> }) => ({
        actionType: item.type,
        message: item.message,
        priority: (item.priority as "high" | "medium" | "low") || "medium",
        actionData: item.data || {},
      }));
    } catch {
      return [];
    }
  },

  async execute(ctx: AgentContext, actionType: string, actionData: Record<string, unknown>): Promise<string> {
    const supabase = getServiceClient();

    switch (actionType) {
      case "create_reminder": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: actionData.title,
          title: actionData.title,
          note: actionData.note || null,
          remind_at: actionData.remind_at,
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `Hatırlatma oluşturuldu: ${actionData.title}`;
      }

      case "mark_task_done":
        return "Görev tamamlandı olarak işaretlendi.";

      case "create_campaign": {
        const { error } = await supabase.from("bayi_campaigns").insert({
          tenant_id: ctx.tenantId,
          name: actionData.name,
          description: actionData.description,
          start_date: actionData.start_date,
          end_date: actionData.end_date,
        });
        if (error) return `Hata: ${error.message}`;
        return "Kampanya oluşturuldu.";
      }

      case "flag_underperformer": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Düşük performans: ${actionData.dealer_name}`,
          title: `Düşük performans: ${actionData.dealer_name}`,
          note: actionData.reason,
          remind_at: new Date().toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için performans uyarısı oluşturuldu.`;
      }

      case "schedule_visit": {
        const { error } = await supabase.from("bayi_dealer_visits").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          visit_date: actionData.visit_date,
          notes: actionData.notes || null,
          created_by: ctx.userId,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için ziyaret planlandı (${formatDate(actionData.visit_date as string)}).`;
      }

      case "create_visit_note": {
        const { error } = await supabase.from("bayi_dealer_visits").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          visit_date: new Date().toISOString().slice(0, 10),
          notes: actionData.note,
          created_by: ctx.userId,
        });
        if (error) return `Hata: ${error.message}`;
        return `${actionData.dealer_name} için ziyaret notu eklendi.`;
      }

      case "record_payment": {
        const { error: txError } = await supabase.from("bayi_dealer_transactions").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          type: "payment",
          amount: actionData.amount,
          note: actionData.note || null,
          created_at: new Date().toISOString(),
        });
        if (txError) return `Hata: ${txError.message}`;

        const { data: dealer } = await supabase.from("bayi_dealers").select("balance").eq("id", actionData.dealer_id).eq("tenant_id", ctx.tenantId).single();
        if (dealer) {
          const newBalance = (dealer.balance || 0) + (actionData.amount as number);
          await supabase.from("bayi_dealers").update({ balance: newBalance }).eq("id", actionData.dealer_id).eq("tenant_id", ctx.tenantId);
        }
        return `${actionData.dealer_name} için ${formatCurrency(actionData.amount as number)} ödeme kaydedildi.`;
      }

      case "create_collection_record": {
        const { error } = await supabase.from("bayi_collection_activities").insert({
          tenant_id: ctx.tenantId,
          dealer_id: actionData.dealer_id,
          activity_type: actionData.activity_type,
          amount: actionData.amount,
          created_at: new Date().toISOString(),
        });
        if (error) return `Hata: ${error.message}`;
        return "Tahsilat kaydı oluşturuldu.";
      }

      case "send_payment_reminder": {
        const { sendText } = await import("@/platform/whatsapp/send");
        const msg = `Sayın ${actionData.dealer_name},\n\n${formatCurrency(actionData.overdue_amount as number)} tutarında vadesi geçmiş ödemeniz bulunmaktadır. En kısa sürede ödeme yapmanızı rica ederiz.\n\nİyi günler.`;
        await sendText(actionData.dealer_phone as string, msg);
        return "Ödeme hatırlatması gönderildi.";
      }

      case "create_purchase_request": {
        const { error } = await supabase.from("bayi_purchase_orders").insert({
          tenant_id: ctx.tenantId,
          product_id: actionData.product_id,
          quantity: actionData.quantity,
          status: "pending",
          note: actionData.note || null,
          created_at: new Date().toISOString(),
        });
        if (error) return `Hata: ${error.message}`;
        return `Satın alma talebi oluşturuldu: ${actionData.product_name} x${actionData.quantity}`;
      }

      case "flag_critical_stock": {
        const { error } = await supabase.from("reminders").insert({
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          topic: `Kritik stok: ${actionData.product_name}`,
          title: `Kritik stok: ${actionData.product_name}`,
          note: `Mevcut: ${actionData.current_quantity}, Minimum: ${actionData.min_stock}. Ürün ID: ${actionData.product_id}`,
          remind_at: new Date(Date.now() + 86400000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "Kritik stok uyarısı oluşturuldu.";
      }

      case "update_order_status": {
        const updateFields: Record<string, unknown> = { status: actionData.new_status };
        if (actionData.note) updateFields.delivery_notes = actionData.note;
        const { error } = await supabase.from("bayi_orders").update(updateFields).eq("id", actionData.order_id).eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Sipariş durumu güncellendi.";
      }

      case "create_delivery_note": {
        const { error } = await supabase.from("bayi_orders").update({ delivery_notes: actionData.note }).eq("id", actionData.order_id).eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return "Teslimat notu kaydedildi.";
      }

      case "update_product_price": {
        const { error } = await supabase.from("bayi_products").update({ unit_price: actionData.new_price }).eq("id", actionData.product_id).eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.product_name} fiyatı güncellendi: ${formatCurrency(actionData.new_price as number)}`;
      }

      case "toggle_product_status": {
        const { error } = await supabase.from("bayi_products").update({ is_active: actionData.new_status }).eq("id", actionData.product_id).eq("tenant_id", ctx.tenantId);
        if (error) return `Hata: ${error.message}`;
        return `${actionData.product_name} ${actionData.new_status ? "aktif" : "pasif"} yapıldı.`;
      }

      case "send_whatsapp": {
        const { sendText } = await import("@/platform/whatsapp/send");
        await sendText(actionData.phone as string, actionData.message as string);
        return "Mesaj gönderildi.";
      }

      default:
        return "İşlem tamamlandı.";
    }
  },
};
