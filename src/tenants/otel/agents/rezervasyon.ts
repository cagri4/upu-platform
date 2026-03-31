/**
 * Rezervasyon Uzmanı Agent
 * Tracks occupancy, today's check-in/out, pricing opportunities.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const rezervasyonAgent: AgentDefinition = {
  key: "otel_rezervasyon",
  name: "Rezervasyon Uzmanı",
  icon: "📅",

  systemPrompt:
    "Sen otelin rezervasyon uzmanısın. Doluluk oranı, bugünkü check-in/out durumu ve fiyat fırsatlarını analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: checkin_hatirlatma (bugünkü check-in hazırlığı), doluluk_uyari (düşük/yüksek doluluk), fiyat_onerisi (fiyat ayarlaması öner). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // Total rooms
    const { count: totalRooms } = await supabase
      .from("otel_rooms")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);

    // Occupied rooms (checked_in reservations)
    const { count: occupiedRooms } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    // Today's check-ins
    const { data: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("id, guest_name, room_number, check_in_date")
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .in("status", ["confirmed", "pending"]);

    // Today's check-outs
    const { data: todayCheckouts } = await supabase
      .from("otel_reservations")
      .select("id, guest_name, room_number, check_out_date")
      .eq("tenant_id", ctx.tenantId)
      .eq("check_out_date", today)
      .eq("status", "checked_in");

    // Tomorrow's check-ins (prep)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const { count: tomorrowCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", tomorrowStr)
      .in("status", ["confirmed", "pending"]);

    const total = totalRooms || 0;
    const occupied = occupiedRooms || 0;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      totalRooms: total,
      occupiedRooms: occupied,
      occupancyRate,
      todayCheckinCount: todayCheckins?.length || 0,
      todayCheckins: (todayCheckins || []).slice(0, 5).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        roomNumber: r.room_number,
      })),
      todayCheckoutCount: todayCheckouts?.length || 0,
      todayCheckouts: (todayCheckouts || []).slice(0, 5).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        roomNumber: r.room_number,
      })),
      tomorrowCheckins: tomorrowCheckins || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const total = data.totalRooms as number;
    if (!total) return "";

    return (
      `Doluluk: %${data.occupancyRate} (${data.occupiedRooms}/${total} oda). ` +
      `Bugün ${data.todayCheckinCount} check-in, ${data.todayCheckoutCount} check-out. ` +
      `Yarın ${data.tomorrowCheckins} check-in bekleniyor.`
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
      case "checkin_hatirlatma":
        return "Check-in hazırlık hatırlatması oluşturuldu";
      case "doluluk_uyari":
        return "Doluluk uyarısı not edildi — musaitlik komutu ile detay görüntüleyebilirsiniz";
      case "fiyat_onerisi":
        return "Fiyat önerisi not edildi — fiyat komutu ile güncelleyebilirsiniz";
      default:
        return "İşlem tamamlandı";
    }
  },
};
