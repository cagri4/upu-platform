import type { ToolDef } from "@/platform/agent/types";

export const listOrdersTool: ToolDef = {
  name: "list_orders",
  description: "Bayi'nin gelen siparişlerini listeler. Durum + bayi + tutar + tarih bilgisi döner. Pending sipariş kontrolü, onay bekleyen iş takibi için kullan.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled", "rejected"],
        description: "Filtre uygulamak istediğin durum. Vermezsen son siparişler döner.",
      },
      limit: {
        type: "number",
        description: "Maks kaç sipariş (default 10).",
      },
    },
  },
  async handler(input, ctx) {
    const status = (input.status as string | undefined) || null;
    const limit = Math.min(50, Number(input.limit) || 10);

    let query = ctx.sb
      .from("bayi_dealer_orders")
      .select("id, status, total_amount, created_at, dealer_user_id, notes")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Bayi rolü = sadece kendi siparişleri. Admin/satis = hepsi.
    if (!["admin", "satis"].includes(ctx.role || "")) {
      query = query.eq("dealer_user_id", ctx.userId);
    }
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { error: "Sipariş listesi alınamadı: " + error.message };

    // Dealer adlarını çöz
    const ids = Array.from(new Set((data || []).map((o) => o.dealer_user_id)));
    const { data: dealers } = ids.length
      ? await ctx.sb.from("profiles").select("id, display_name, metadata").in("id", ids)
      : { data: [] };
    const dealerMap = Object.fromEntries(
      (dealers || []).map((d) => {
        const meta = (d.metadata as Record<string, unknown>) || {};
        const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
        return [d.id, firma?.ticari_unvan || d.display_name || "Bayi"];
      }),
    );

    return {
      orders: (data || []).map((o) => ({
        id: `#${(o.id as string).slice(0, 8)}`,
        status: o.status,
        amount: Number(o.total_amount),
        currency: "TRY",
        dealer: dealerMap[o.dealer_user_id as string] || "Bayi",
        created_at: o.created_at,
        notes: o.notes || null,
      })),
      total: data?.length || 0,
    };
  },
};
