/**
 * Pazar Analisti Agent
 * Compares user's property prices to market averages per district.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const pazarAgent: AgentDefinition = {
  key: "pazar",
  name: "Pazar Analisti",
  icon: "📊",

  systemPrompt:
    "Sen emlak ofisinin pazar analistsin. Bölge bazlı fiyat analizlerini değerlendir. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: fiyat_analiz (bölge fiyat değişimi), deger_guncelle (mülk değeri güncellemesi öner), pazar_rapor (pazar raporu). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Get user's properties with district info
    const { data: userProps } = await supabase
      .from("emlak_properties")
      .select("id, title, price, district, square_meters")
      .eq("user_id", ctx.userId)
      .not("district", "is", null);

    if (!userProps || userProps.length === 0) {
      return { districtCount: 0 };
    }

    // Get unique districts from user's portfolio
    const districts = [...new Set(userProps.map((p) => p.district).filter(Boolean))] as string[];

    // For each district, get market average
    const districtAnalysis: Array<{
      district: string;
      userAvg: number;
      marketAvg: number;
      userCount: number;
      marketCount: number;
    }> = [];

    for (const district of districts) {
      const userDistrictProps = userProps.filter((p) => p.district === district);
      const userAvg =
        userDistrictProps.reduce((s, p) => s + (p.price || 0), 0) /
        userDistrictProps.length;

      const { data: marketProps } = await supabase
        .from("emlak_properties")
        .select("price")
        .eq("district", district)
        .not("price", "is", null);

      const marketAvg =
        marketProps && marketProps.length > 0
          ? marketProps.reduce((s, p) => s + (p.price || 0), 0) /
            marketProps.length
          : 0;

      districtAnalysis.push({
        district,
        userAvg: Math.round(userAvg),
        marketAvg: Math.round(marketAvg),
        userCount: userDistrictProps.length,
        marketCount: marketProps?.length || 0,
      });
    }

    return {
      districtCount: districts.length,
      analysis: districtAnalysis,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    if (!data.districtCount || (data.districtCount as number) === 0) return "";

    const analysis = data.analysis as Array<{
      district: string;
      userAvg: number;
      marketAvg: number;
      userCount: number;
      marketCount: number;
    }>;

    const lines = analysis.map((a) => {
      const diff =
        a.marketAvg > 0
          ? Math.round(((a.userAvg - a.marketAvg) / a.marketAvg) * 100)
          : 0;
      const diffLabel = diff > 0 ? `+${diff}%` : `${diff}%`;
      return `${a.district}: Sizin ort. ₺${a.userAvg.toLocaleString("tr-TR")} / Piyasa ort. ₺${a.marketAvg.toLocaleString("tr-TR")} (${diffLabel}, ${a.userCount} mülk / ${a.marketCount} piyasa)`;
    });

    return `Bölge fiyat analizi:\n${lines.join("\n")}`;
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
      case "fiyat_analiz":
        return "Bölge fiyat analizi oluşturuldu";
      case "deger_guncelle":
        return "Mülk değeri güncelleme önerisi not edildi — mulkduzenle ile güncelleyebilirsiniz";
      case "pazar_rapor":
        return "Pazar raporu önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
