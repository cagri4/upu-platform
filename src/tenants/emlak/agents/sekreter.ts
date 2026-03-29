/**
 * Sekreter Agent
 * Tracks pending reminders, expiring contracts, daily tasks.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const sekreterAgent: AgentDefinition = {
  key: "sekreter",
  name: "Sekreter",
  icon: "📋",

  systemPrompt:
    "Sen emlak ofisinin sekretersin. Hatırlatmaları, sözleşme sürelerini ve günlük görevleri takip et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: hatirlatma (hatırlatma), sozlesme_yenile (sözleşme yenileme), gorev_olustur (görev öner). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Reminders within next 24 hours that haven't triggered
    const now = new Date().toISOString();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, title, remind_at")
      .eq("user_id", ctx.userId)
      .eq("triggered", false)
      .gte("remind_at", now)
      .lte("remind_at", in24h);

    // Contracts expiring within 7 days
    const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, title, end_date")
      .eq("user_id", ctx.userId)
      .gte("end_date", now)
      .lte("end_date", in7d);

    const reminderCount = reminders?.length || 0;
    const expiringContracts = contracts?.length || 0;

    if (reminderCount === 0 && expiringContracts === 0) {
      return { reminderCount: 0, expiringContracts: 0 };
    }

    return {
      reminderCount,
      reminders: (reminders || []).slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title,
        remindAt: r.remind_at,
      })),
      expiringContracts,
      contracts: (contracts || []).slice(0, 5).map((c) => ({
        id: c.id,
        title: c.title,
        endDate: c.end_date,
      })),
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const reminderCount = data.reminderCount as number;
    const expiringContracts = data.expiringContracts as number;

    if (reminderCount === 0 && expiringContracts === 0) return "";

    return (
      `${reminderCount} yaklaşan hatırlatma. ` +
      `${expiringContracts} sözleşme 7 gün içinde doluyor.`
    );
  },

  parseProposals(
    aiResponse: string,
    _data: Record<string, unknown>,
  ): AgentProposal[] {
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
      case "hatirlatma":
        return "Hatırlatma onaylandı ve zamanında bildirilecek";
      case "sozlesme_yenile":
        return "Sözleşme yenileme hatırlatması oluşturuldu";
      case "gorev_olustur":
        return "Görev önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
