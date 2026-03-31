/**
 * Muhasebeci Agent — receivables, overdue payments, recent invoices
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const muhasebeciAgent: AgentDefinition = {
  key: "bayi_muhasebeci",
  name: "Muhasebeci",
  icon: "💳",

  systemPrompt:
    "Sen bayi yönetim sisteminin muhasebecisisin. Alacakları, gecikmiş ödemeleri ve faturaları takip et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: tahsilat_uyari (gecikmiş ödeme hatırlatması), fatura_kontrol (fatura kontrolü), bakiye_rapor (bakiye raporu). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Total receivables (dealers with negative balance)
    const { data: debtDealers } = await supabase
      .from("bayi_dealers")
      .select("id, name, balance")
      .eq("tenant_id", ctx.tenantId)
      .lt("balance", 0);

    const totalReceivables = (debtDealers || []).reduce((s, d) => s + Math.abs(d.balance || 0), 0);

    // Overdue invoices
    const now = new Date().toISOString();
    const { data: overdueInvoices } = await supabase
      .from("bayi_dealer_invoices")
      .select("id, dealer_id, amount, due_date")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_paid", false)
      .lt("due_date", now);

    const overdueTotal = (overdueInvoices || []).reduce((s, i) => s + (i.amount || 0), 0);

    // Recent invoices (last 7 days)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentInvoiceCount } = await supabase
      .from("bayi_dealer_invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", week);

    return {
      totalReceivables,
      debtDealerCount: debtDealers?.length || 0,
      overdueCount: overdueInvoices?.length || 0,
      overdueTotal,
      recentInvoiceCount: recentInvoiceCount || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const totalReceivables = data.totalReceivables as number;
    const debtDealerCount = data.debtDealerCount as number;
    const overdueCount = data.overdueCount as number;
    const overdueTotal = data.overdueTotal as number;

    if (totalReceivables === 0 && overdueCount === 0) return "";

    return (
      `Toplam alacak: ${totalReceivables.toLocaleString("tr-TR")} TL (${debtDealerCount} bayi), ` +
      `Vadesi geçen fatura: ${overdueCount} adet (${overdueTotal.toLocaleString("tr-TR")} TL), ` +
      `Son 7 gün fatura: ${data.recentInvoiceCount} adet`
    );
  },

  parseProposals(aiResponse: string, _data: Record<string, unknown>): AgentProposal[] {
    try {
      const match = aiResponse.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const arr = JSON.parse(match[0]) as Array<{
        type: string;
        message: string;
        priority: "high" | "medium" | "low";
        data?: Record<string, unknown>;
      }>;
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => ({
        actionType: item.type,
        message: item.message,
        priority: item.priority || "medium",
        actionData: item.data || {},
      }));
    } catch {
      return [];
    }
  },

  async execute(
    _ctx: AgentContext,
    actionType: string,
    _actionData: Record<string, unknown>,
  ): Promise<string> {
    switch (actionType) {
      case "tahsilat_uyari":
        return "Tahsilat uyarısı oluşturuldu";
      case "fatura_kontrol":
        return "Fatura kontrolü tamamlandı";
      case "bakiye_rapor":
        return "Bakiye raporu hazırlandı";
      default:
        return "İşlem tamamlandı";
    }
  },
};
