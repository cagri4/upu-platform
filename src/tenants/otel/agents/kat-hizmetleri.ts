/**
 * Kat Hizmetleri Agent
 * Tracks room cleaning status, maintenance needs, and housekeeping tasks.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const katHizmetleriAgent: AgentDefinition = {
  key: "otel_katHizmetleri",
  name: "Kat Hizmetleri",
  icon: "🧹",

  systemPrompt:
    "Sen otelin kat hizmetleri sorumlusun. Oda temizlik durumu, bakım ihtiyaçları ve görev atamalarını analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: temizlik_gerekli (temizlenmemiş oda), bakim_gerekli (bakım/onarım ihtiyacı), gorev_ata (personele görev ata). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Rooms needing cleaning (dirty rooms)
    const { data: dirtyRooms } = await supabase
      .from("otel_rooms")
      .select("id, room_number, room_type, cleaning_status")
      .eq("tenant_id", ctx.tenantId)
      .eq("cleaning_status", "dirty");

    // Rooms under maintenance
    const { data: maintenanceRooms } = await supabase
      .from("otel_rooms")
      .select("id, room_number, room_type, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "maintenance");

    // Today's check-outs (rooms that will need cleaning)
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCheckouts } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_out_date", today)
      .eq("status", "checked_in");

    // Today's check-ins (rooms that need to be ready)
    const { count: todayCheckins } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("check_in_date", today)
      .in("status", ["confirmed", "pending"]);

    const dirtyCount = dirtyRooms?.length || 0;
    const maintenanceCount = maintenanceRooms?.length || 0;

    if (dirtyCount === 0 && maintenanceCount === 0 && (todayCheckouts || 0) === 0) {
      return { dirtyCount: 0, maintenanceCount: 0, todayCheckouts: 0, todayCheckins: 0 };
    }

    return {
      dirtyCount,
      dirtyRooms: (dirtyRooms || []).slice(0, 5).map((r) => ({
        id: r.id,
        roomNumber: r.room_number,
        roomType: r.room_type,
      })),
      maintenanceCount,
      maintenanceRooms: (maintenanceRooms || []).slice(0, 5).map((r) => ({
        id: r.id,
        roomNumber: r.room_number,
        roomType: r.room_type,
      })),
      todayCheckouts: todayCheckouts || 0,
      todayCheckins: todayCheckins || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const dirty = data.dirtyCount as number;
    const maintenance = data.maintenanceCount as number;
    const checkouts = data.todayCheckouts as number;
    const checkins = data.todayCheckins as number;

    if (dirty === 0 && maintenance === 0 && checkouts === 0) return "";

    return (
      `${dirty} oda temizlik bekliyor. ` +
      `${maintenance} oda bakımda. ` +
      `Bugün ${checkouts} check-out (temizlenecek), ${checkins} check-in (hazır olmalı).`
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
      case "temizlik_gerekli":
        return "Temizlik hatırlatması oluşturuldu — temizlik komutu ile durumu güncelleyebilirsiniz";
      case "bakim_gerekli":
        return "Bakım bildirimi not edildi — odaguncelle komutu ile durumu güncelleyebilirsiniz";
      case "gorev_ata":
        return "Görev atama önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
