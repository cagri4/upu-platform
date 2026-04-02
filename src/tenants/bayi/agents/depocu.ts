/**
 * Depocu Agent — V2 (tool-using, memory-backed)
 *
 * Manages stock levels, critical stock alerts, stock movements, suppliers,
 * and purchase orders for the bayi tenant.
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
import { createProposalAndNotify, formatCurrency } from "./helpers";

// ── Domain Tools ────────────────────────────────────────────────────────

const DEPOCU_TOOLS: AgentToolDefinition[] = [
  {
    name: "read_stock_status",
    description:
      "Stok durumunu oku. Tüm ürünler veya sadece kritik stok.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "critical"],
          description: "Filtre: tüm ürünler veya kritik stok",
        },
      },
      required: [],
    },
  },
  {
    name: "read_stock_movements",
    description:
      "Son stok hareketlerini oku. Giriş/çıkış kayıtları.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "read_pending_purchases",
    description:
      "Bekleyen satın alma siparişlerini oku.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_purchase_request",
    description:
      "Satın alma talebi oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Ürün ID" },
        product_name: { type: "string", description: "Ürün adı (gösterim için)" },
        quantity: { type: "number", description: "Talep edilen miktar" },
        note: { type: "string", description: "Not (opsiyonel)" },
      },
      required: ["product_id", "product_name", "quantity"],
    },
  },
  {
    name: "flag_critical_stock",
    description:
      "Kritik stok uyarısı oluştur. Kullanıcı onayı gerektirir.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Ürün ID" },
        product_name: { type: "string", description: "Ürün adı" },
        current_quantity: { type: "number", description: "Mevcut stok miktarı" },
        min_stock: { type: "number", description: "Minimum stok seviyesi" },
      },
      required: ["product_id", "product_name", "current_quantity", "min_stock"],
    },
  },
  {
    name: "draft_message",
    description:
      "Tedarikçiye veya ilgiliye taslak WhatsApp mesajı hazırla. Direkt göndermez, kullanıcıya gösterir.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Kişi adı" },
        customer_phone: { type: "string", description: "Telefon numarası" },
        message_text: { type: "string", description: "Mesaj metni" },
      },
      required: ["customer_name", "customer_phone", "message_text"],
    },
  },
];

// ── Domain Tool Handlers ────────────────────────────────────────────────

async function handleReadStockStatus(
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();
  const filter = input.filter as string | undefined;

  let query = supabase
    .from("bayi_products")
    .select("id, name, stock_quantity, min_stock, price")
    .eq("tenant_id", ctx.tenantId)
    .order("stock_quantity", { ascending: true })
    .limit(20);

  if (filter === "critical") {
    // Critical: stock below min_stock, or below 10 if no min_stock set
    query = query.or("stock_quantity.lt.min_stock,and(min_stock.is.null,stock_quantity.lt.10)");
  }

  const { data, error } = await query;
  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) {
    return {
      result: filter === "critical" ? "Kritik stok seviyesinde ürün yok." : "Depoda ürün yok.",
      needsApproval: false,
    };
  }

  // For critical filter, do client-side filtering as well (Supabase or() with column refs is limited)
  let filtered = data;
  if (filter === "critical") {
    filtered = data.filter((p) => {
      const threshold = p.min_stock || 10;
      return (p.stock_quantity || 0) < threshold;
    });
    if (!filtered.length) return { result: "Kritik stok seviyesinde ürün yok.", needsApproval: false };
  }

  const list = filtered.map((p) => {
    const price = p.price ? formatCurrency(p.price) : "fiyat yok";
    const minLabel = p.min_stock ? `min:${p.min_stock}` : "min:?";
    return `- [${p.id}] ${p.name} | stok:${p.stock_quantity ?? 0} | ${minLabel} | ${price}`;
  });

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadStockMovements(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  // Show recently changed products as a proxy for stock movements
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bayi_products")
    .select("id, name, stock_quantity, min_stock, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .gte("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: false })
    .limit(15);

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Son 7 günde stok hareketi yok.", needsApproval: false };

  const list = data.map((p) => {
    const date = new Date(p.updated_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${p.id}] ${p.name} | stok:${p.stock_quantity ?? 0} | son güncelleme:${date}`;
  });

  return { result: list.join("\n"), needsApproval: false };
}

async function handleReadPendingPurchases(
  _input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("bayi_purchase_orders")
    .select("id, supplier_id, total_amount, status, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { result: `Hata: ${error.message}`, needsApproval: false };
  if (!data?.length) return { result: "Bekleyen satın alma siparişi yok.", needsApproval: false };

  const list = data.map((po) => {
    const amount = po.total_amount ? formatCurrency(po.total_amount) : "tutar yok";
    const date = new Date(po.created_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `- [${po.id}] Tedarikçi:${po.supplier_id || "?"} | ${amount} | ${date}`;
  });

  return { result: list.join("\n"), needsApproval: false };
}

async function handleCreatePurchaseRequest(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const productName = input.product_name as string;
  const quantity = input.quantity as number;
  const note = (input.note as string) || "";

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_depocu",
    actionType: "create_purchase_request",
    actionData: {
      product_id: input.product_id,
      product_name: productName,
      quantity,
      note,
    },
    message: `"${productName}" icin ${quantity} adet satin alma talebi olusturulsun mu?${note ? `\n📝 ${note}` : ""}`,
    buttonLabel: "✅ Talebi Oluştur",
  });
}

async function handleFlagCriticalStock(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  const productName = input.product_name as string;
  const currentQty = input.current_quantity as number;
  const minStock = input.min_stock as number;

  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_depocu",
    actionType: "flag_critical_stock",
    actionData: {
      product_id: input.product_id,
      product_name: productName,
      current_quantity: currentQty,
      min_stock: minStock,
    },
    message: `⚠️ "${productName}" kritik stok seviyesinde!\nMevcut: ${currentQty} | Minimum: ${minStock}\nUyari olusturulsun mu?`,
    buttonLabel: "✅ Uyarı Oluştur",
  });
}

async function handleDraftMessage(
  input: Record<string, unknown>,
  ctx: AgentContext,
  taskId: string,
  agentName: string,
  agentIcon: string,
): Promise<ToolResult> {
  return createProposalAndNotify({
    ctx,
    taskId,
    agentName,
    agentIcon,
    agentKey: "bayi_depocu",
    actionType: "send_whatsapp",
    actionData: { phone: input.customer_phone, message: input.message_text },
    message: `✉️ *${input.customer_name}* kişisine mesaj taslağı:\n\n📱 ${input.customer_phone}\n💬 _${input.message_text}_`,
    buttonLabel: "✅ Gönder",
  });
}

const depocuToolHandlers: Record<string, ToolHandler> = {
  read_stock_status: (input, ctx) => handleReadStockStatus(input, ctx),
  read_stock_movements: (input, ctx) => handleReadStockMovements(input, ctx),
  read_pending_purchases: (input, ctx) => handleReadPendingPurchases(input, ctx),
  create_purchase_request: handleCreatePurchaseRequest,
  flag_critical_stock: handleFlagCriticalStock,
  draft_message: handleDraftMessage,
};

// ── Agent Definition ────────────────────────────────────────────────────

export const depocuAgent: AgentDefinition = {
  key: "bayi_depocu",
  name: "Depocu",
  icon: "📦",
  tools: DEPOCU_TOOLS,
  toolHandlers: depocuToolHandlers,

  systemPrompt:
    `Sen bayi yönetim sisteminin depocususun. Görevin stok seviyelerini takip etmek, kritik stok uyarıları oluşturmak, stok hareketlerini izlemek ve satın alma talepleri yönetmek.\n\n` +
    `## Kullanabileceğin Araçlar\n` +
    `- read_stock_status: Stok durumunu oku (tüm ürünler veya kritik)\n` +
    `- read_stock_movements: Son stok hareketlerini oku\n` +
    `- read_pending_purchases: Bekleyen satın alma siparişlerini oku\n` +
    `- create_purchase_request: Satın alma talebi oluştur (onay gerektirir)\n` +
    `- flag_critical_stock: Kritik stok uyarısı oluştur (onay gerektirir)\n` +
    `- draft_message: Taslak WhatsApp mesajı hazırla (onay gerektirir)\n` +
    `- notify_human: Kullanıcıya bildirim/öneri gönder\n` +
    `- read_db: Veritabanından veri oku\n\n` +
    `## Kurallar\n` +
    `- Kimseye ASLA direkt mesaj gönderme, her zaman draft_message veya notify_human kullan.\n` +
    `- Her kritik aksiyon için kullanıcı onayı al.\n` +
    `- Önce veri topla (read_stock_status, read_pending_purchases), sonra analiz et, sonra aksiyon öner.\n` +
    `- Kullanıcı tercihlerine (agent_config) göre davran: kritik stok bildirimi, stok kontrol sıklığı, otomatik satın alma.\n` +
    `- Kritik stok seviyesindeki ürünlere acil müdahale gerekir.\n` +
    `- Otonomi seviyesi: HER ŞEYİ SOR — hiçbir yazma işlemini onaysız yapma.\n` +
    `- Yapılacak bir şey yoksa hiçbir tool çağırma, kısa bir Türkçe özet yaz.\n` +
    `- Türkçe yanıt ver.\n`,

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const config = await getAgentConfig(ctx.userId, "bayi_depocu");

    // Low stock items (below min_stock or below 10)
    const { data: lowStock } = await supabase
      .from("bayi_products")
      .select("id, name, stock_quantity, min_stock")
      .eq("tenant_id", ctx.tenantId)
      .lt("stock_quantity", 10)
      .order("stock_quantity", { ascending: true })
      .limit(10);

    // Pending purchase orders
    const { data: pendingPOs } = await supabase
      .from("bayi_purchase_orders")
      .select("id, supplier_id, total_amount, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending");

    // Total product count
    const { count: totalProductCount } = await supabase
      .from("bayi_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    const recentMessages = await getRecentMessages(ctx.userId, "bayi_depocu", 10);
    const taskHistory = await getTaskHistory(ctx.userId, "bayi_depocu", 5);

    return {
      lowStockCount: lowStock?.length || 0,
      agentConfig: config,
      lowStockItems: (lowStock || []).map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.stock_quantity,
        minStock: p.min_stock,
      })),
      pendingPOCount: pendingPOs?.length || 0,
      pendingPOTotal: (pendingPOs || []).reduce((s, po) => s + (po.total_amount || 0), 0),
      totalProducts: totalProductCount || 0,
      recentDecisions: taskHistory
        .filter((t) => t.status === "done" && t.execution_log?.length)
        .slice(0, 3)
        .map((t) => ({
          date: t.created_at,
          actions: (t.execution_log || []).map((l) => `${l.action}: ${l.status}`),
        })),
      messageHistory: recentMessages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content.substring(0, 200),
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const lowStockCount = data.lowStockCount as number;
    const pendingPOCount = data.pendingPOCount as number;
    const totalProducts = data.totalProducts as number;
    const pendingPOTotal = data.pendingPOTotal as number;

    if (totalProducts === 0 && pendingPOCount === 0) return "";

    const recentDecisions = data.recentDecisions as Array<{ date: string; actions: string[] }>;
    const messageHistory = data.messageHistory as Array<{ role: string; content: string }>;
    const config = data.agentConfig as Record<string, unknown> | null;

    let prompt = `## Mevcut Durum\n`;
    prompt += `Tarih: ${new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

    if (config) {
      prompt += `### Kullanıcı Tercihleri\n`;
      if (config.kritik_stok_bildirimi) prompt += `- Kritik stok bildirimi: ${config.kritik_stok_bildirimi === "evet" ? "Aktif" : "Kapalı"}\n`;
      if (config.stok_kontrol_sikligi) prompt += `- Stok kontrol sıklığı: ${config.stok_kontrol_sikligi}\n`;
      if (config.otomatik_satinalma) prompt += `- Otomatik satın alma önerisi: ${config.otomatik_satinalma === "evet" ? "Aktif" : "Önce sorar"}\n`;
      prompt += `\n`;
    }

    prompt += `### Depo Özeti\n`;
    prompt += `- Toplam ürün: ${totalProducts}\n`;
    prompt += `- Kritik stok: ${lowStockCount} ürün\n`;
    prompt += `- Bekleyen satın alma: ${pendingPOCount}`;
    if (pendingPOTotal) {
      prompt += ` (${formatCurrency(pendingPOTotal)})`;
    }
    prompt += `\n`;

    const lowStockItems = data.lowStockItems as Array<{
      id: string;
      name: string;
      quantity: number;
      minStock: number | null;
    }>;
    if (lowStockItems?.length) {
      prompt += `\n### Kritik Stok Ürünleri\n`;
      for (const item of lowStockItems) {
        const minLabel = item.minStock ? `min:${item.minStock}` : "min:?";
        prompt += `- [${item.id}] ${item.name} | stok:${item.quantity} | ${minLabel}\n`;
      }
    }

    if (recentDecisions?.length) {
      prompt += `\n### Son Kararlar\n`;
      for (const d of recentDecisions) {
        const dt = new Date(d.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
        prompt += `- ${dt}: ${d.actions.join(", ")}\n`;
      }
    }

    if (messageHistory?.length) {
      prompt += `\n### Son Mesajlar\n`;
      for (const m of messageHistory) {
        prompt += `[${m.role}] ${m.content}\n`;
      }
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
          remind_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          triggered: false,
        });
        if (error) return `Hata: ${error.message}`;
        return "Kritik stok uyarısı oluşturuldu.";
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
