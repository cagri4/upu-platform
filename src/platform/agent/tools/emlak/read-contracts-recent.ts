import type { ToolDef } from "@/platform/agent/types";

/**
 * Son sözleşmeler — durum dağılımı + son N (default 10) sözleşme.
 * contracts tablosu: type, status, contract_data (json), signed_at,
 * property_id, user_id. Mülk bilgisini opsiyonel olarak join eder
 * (read overhead küçük; 10 sözleşme için kabul edilebilir).
 */
export const readContractsRecentTool: ToolDef = {
  name: "read_contracts_recent",
  description:
    "Son sözleşmelerin listesini döner — toplam aktif/iptal/taslak sayısı, son N (default 10) sözleşmenin türü, durumu ve imza tarihi. 'Son sözleşmelerim', 'bu hafta kaç sözleşme', 'imzalı kaç tane' soruları için.",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Listelenecek max sözleşme (default 10, max 50).",
      },
      status: {
        type: "string",
        description: "Opsiyonel filtre — örn. 'signed', 'draft', 'cancelled'.",
      },
    },
  },
  async handler(input, ctx) {
    const limit = typeof input.limit === "number" ? Math.max(1, Math.min(50, Math.floor(input.limit))) : 10;
    const status = typeof input.status === "string" ? input.status : null;

    let recentQuery = ctx.sb
      .from("contracts")
      .select("id, type, status, signed_at, created_at, property_id, contract_data")
      .eq("user_id", ctx.userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) recentQuery = recentQuery.eq("status", status);

    const [breakdownRes, recentRes] = await Promise.all([
      ctx.sb
        .from("contracts")
        .select("status")
        .eq("user_id", ctx.userId)
        .neq("status", "deleted"),
      recentQuery,
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of (breakdownRes.data || []) as Array<{ status: string | null }>) {
      if (row.status) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }

    return {
      total: (breakdownRes.data || []).length,
      by_status: byStatus,
      recent: (recentRes.data || []).map((c) => {
        const data = (c.contract_data || {}) as Record<string, unknown>;
        return {
          id: c.id,
          type: c.type,
          status: c.status,
          signed_at: c.signed_at,
          created_at: c.created_at,
          property_id: c.property_id,
          parties: {
            buyer: (data.buyer_name as string) || null,
            seller: (data.seller_name as string) || null,
          },
          price_TRY: (data.price as number) || (data.amount as number) || null,
        };
      }),
    };
  },
};
