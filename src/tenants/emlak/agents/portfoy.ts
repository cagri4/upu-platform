/**
 * Portfoy Sorumlusu Agent
 * Analyzes user's property portfolio — missing fields, stale listings, value summary.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const portfoyAgent: AgentDefinition = {
  key: "portfoy",
  name: "Portfoy Sorumlusu",
  icon: "🏠",

  systemPrompt:
    "Sen emlak ofisinin portföy sorumlusun. Portföy verilerini analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: eksik_bilgi (eksik alanları tamamla), fiyat_guncelle (uzun süre satılmayan mülk fiyatını güncelle), mulk_sil (kaldırılmış ilan). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, price, photo_count, square_meters, listing_type, created_at")
      .eq("user_id", ctx.userId);

    if (!properties || properties.length === 0) {
      return { count: 0 };
    }

    const count = properties.length;
    const missingPhotos = properties.filter(
      (p) => !p.photo_count || p.photo_count === 0,
    ).length;
    const missingM2 = properties.filter((p) => !p.square_meters).length;

    // Find oldest unsold satilik property
    const satilikProps = properties
      .filter((p) => p.listing_type === "satilik")
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

    const oldest = satilikProps[0] || null;
    const daysOld = oldest
      ? Math.floor(
          (Date.now() - new Date(oldest.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const totalValue = properties.reduce(
      (sum, p) => sum + (p.price || 0),
      0,
    );

    return {
      count,
      missingPhotos,
      missingM2,
      oldestTitle: oldest?.title || "-",
      oldestId: oldest?.id || null,
      daysOld,
      totalValue,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (!data.count || (data.count as number) === 0) return "";

    return (
      `Portföy: ${data.count} mülk, ${data.missingPhotos} fotoğrafsız, ${data.missingM2} m² eksik, ` +
      `En eski ilan: ${data.oldestTitle} (${data.daysOld} gün), ` +
      `Toplam değer: ₺${Number(data.totalValue).toLocaleString("tr-TR")}`
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
      case "eksik_bilgi":
        return "Eksik bilgi hatırlatması gönderildi";
      case "fiyat_guncelle":
        return "Fiyat güncelleme önerisi not edildi — mulkduzenle ile güncelleyebilirsiniz";
      case "mulk_sil":
        return "Mülk silme önerisi not edildi — mulksil ile silebilirsiniz";
      default:
        return "İşlem tamamlandı";
    }
  },
};
