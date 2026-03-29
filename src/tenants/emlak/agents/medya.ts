/**
 * Medya Uzmani Agent
 * Tracks properties without photos, unpublished listings, publishing history.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const medyaAgent: AgentDefinition = {
  key: "medya",
  name: "Medya Uzmanı",
  icon: "📸",

  systemPrompt:
    "Sen emlak ofisinin medya uzmanısın. Fotoğraf eksiklikleri ve yayın durumunu analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: foto_eksik (fotoğraf yükle), yayinla (portale yayınla), ilan_metni (ilan metni oluştur). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Properties without photos
    const { data: properties } = await supabase
      .from("emlak_properties")
      .select("id, title, photo_count")
      .eq("user_id", ctx.userId);

    if (!properties || properties.length === 0) {
      return { totalCount: 0 };
    }

    const noPhotoProps = properties.filter(
      (p) => !p.photo_count || p.photo_count === 0,
    );

    // Properties not in publishing history
    const { data: published } = await supabase
      .from("emlak_publishing_history")
      .select("property_id")
      .eq("user_id", ctx.userId);

    const publishedIds = new Set((published || []).map((p) => p.property_id));
    const unpublishedCount = properties.filter(
      (p) => !publishedIds.has(p.id),
    ).length;

    return {
      totalCount: properties.length,
      noPhotoCount: noPhotoProps.length,
      noPhotoSample: noPhotoProps.slice(0, 3).map((p) => ({
        id: p.id,
        title: p.title,
      })),
      unpublishedCount,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (!data.totalCount || (data.totalCount as number) === 0) return "";

    return (
      `${data.noPhotoCount} mülkte fotoğraf yok. ` +
      `${data.unpublishedCount} mülk yayınlanmamış.`
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
      case "foto_eksik":
        return "Fotoğraf yükleme hatırlatması gönderildi — mulkduzenle ile fotoğraf ekleyebilirsiniz";
      case "yayinla":
        return "Yayınlama önerisi not edildi — yayinla komutu ile portallere gönderebilirsiniz";
      case "ilan_metni":
        return "İlan metni oluşturma önerisi not edildi — ilanmetni komutu ile AI destekli metin oluşturabilirsiniz";
      default:
        return "İşlem tamamlandı";
    }
  },
};
