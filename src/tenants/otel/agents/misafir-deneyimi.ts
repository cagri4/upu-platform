/**
 * Misafir Deneyimi Agent
 * Tracks guest satisfaction, reviews, special requests, and daily briefing.
 */

import type { AgentContext, AgentDefinition, AgentProposal } from "@/platform/agents/types";
import { getServiceClient } from "@/platform/auth/supabase";

export const misafirDeneyimiAgent: AgentDefinition = {
  key: "otel_misafirDeneyimi",
  name: "Misafir Deneyimi",
  icon: "⭐",

  systemPrompt:
    "Sen otelin misafir deneyimi sorumlusun. Misafir memnuniyeti, yorumlar, özel istekler ve deneyim iyileştirmelerini analiz et. " +
    "Yapılması gereken en önemli 1-3 aksiyonu JSON array olarak döndür. " +
    'Her aksiyon: {"type": "action_type", "message": "kullanıcıya gösterilecek Türkçe mesaj", "priority": "high|medium|low", "data": {}}. ' +
    "Aksiyon tipleri: yorum_takip (olumsuz yorum/geri bildirim), ozel_istek (misafir özel isteği), deneyim_onerisi (iyileştirme önerisi). " +
    "Yapılacak bir şey yoksa boş array dön: []",

  async gatherContext(ctx: AgentContext): Promise<Record<string, unknown>> {
    const supabase = getServiceClient();

    // Recent reviews/feedback
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reviews } = await supabase
      .from("otel_guest_reviews")
      .select("id, guest_name, rating, comment, created_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    const reviewCount = reviews?.length || 0;
    const avgRating = reviewCount > 0
      ? Math.round((reviews!.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount) * 10) / 10
      : 0;
    const lowRatings = (reviews || []).filter((r) => r.rating && r.rating <= 3);

    // Special requests pending
    const { data: requests } = await supabase
      .from("otel_guest_requests")
      .select("id, guest_name, request_type, description, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pending")
      .limit(10);

    const pendingRequests = requests?.length || 0;

    // Active guests count
    const { count: activeGuests } = await supabase
      .from("otel_reservations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "checked_in");

    if (reviewCount === 0 && pendingRequests === 0) {
      return { reviewCount: 0, pendingRequests: 0, activeGuests: activeGuests || 0 };
    }

    return {
      reviewCount,
      avgRating,
      lowRatingCount: lowRatings.length,
      lowRatings: lowRatings.slice(0, 3).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        rating: r.rating,
        comment: r.comment?.substring(0, 80),
      })),
      pendingRequests,
      requests: (requests || []).slice(0, 5).map((r) => ({
        id: r.id,
        guestName: r.guest_name,
        type: r.request_type,
        description: r.description?.substring(0, 60),
      })),
      activeGuests: activeGuests || 0,
    };
  },

  formatPrompt(data: Record<string, unknown>): string {
    const reviews = data.reviewCount as number;
    const pending = data.pendingRequests as number;

    if (reviews === 0 && pending === 0) return "";

    return (
      `Bu hafta ${reviews} yorum, ortalama puan: ${data.avgRating}/5. ` +
      `${data.lowRatingCount} düşük puan (3 ve altı). ` +
      `${pending} bekleyen özel istek. ` +
      `${data.activeGuests} aktif misafir.`
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
      case "yorum_takip":
        return "Yorum takip hatırlatması oluşturuldu";
      case "ozel_istek":
        return "Özel istek bildirimi not edildi";
      case "deneyim_onerisi":
        return "Deneyim iyileştirme önerisi not edildi";
      default:
        return "İşlem tamamlandı";
    }
  },
};
