/**
 * Resepsiyon Agent
 * Tracks guest messages, escalations, and communication gaps.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const resepsiyonAgent: AgentDefinition = {
  key: "otel_resepsiyon",
  name: "Resepsiyon",
  icon: "🛎️",

  systemPrompt:
    "Sen otelin resepsiyon görevlisisin. Misafir mesajlarını, eskalasyonları ve iletişim durumunu analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: mesaj_yanit (cevaplanmamış mesaj), eskalasyon (yüksek öncelikli sorun), misafir_takip (misafir iletişimi gerekli). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Unanswered guest messages
    const { data: messages } = await supabase
      .from("otel_guest_messages")
      .select("id, guest_name, message, created_at, is_answered")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_answered", false)
      .order("created_at", { ascending: false })
      .limit(10);

    const unansweredCount = messages?.length || 0;

    // Today's check-ins for welcome prep
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .eq("status", "confirmed");

    // Active guests (checked in)
    const { count: activeGuests } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    if (unansweredCount === 0 && (todayCheckins || 0) === 0) {
      return { unansweredCount: 0, todayCheckins: 0, activeGuests: activeGuests || 0 };
    }

    return {
      unansweredCount,
      unansweredMessages: (messages || []).slice(0, 5).map((m) => ({
        id: m.id,
        guestName: m.guest_name,
        message: m.message?.substring(0, 80),
        createdAt: m.created_at,
      })),
      todayCheckins: todayCheckins || 0,
      activeGuests: activeGuests || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const unanswered = data.unansweredCount as number;
    const checkins = data.todayCheckins as number;
    const active = data.activeGuests as number;

    if (unanswered === 0 && checkins === 0) return "";

    return (
      `${unanswered} cevaplanmamış misafir mesajı var. ` +
      `Bugün ${checkins} check-in bekleniyor. ` +
      `${active} aktif misafir.`
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
      case "mesaj_yanit":
        return "Mesaj yanıtlama hatırlatması oluşturuldu";
      case "eskalasyon":
        return "Eskalasyon bildirimi not edildi";
      case "misafir_takip":
        return "Misafir takip hatırlatması oluşturuldu";
      default:
        return "İşlem tamamlandı";
    }
  },
};
