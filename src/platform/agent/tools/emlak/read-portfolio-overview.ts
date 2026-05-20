import type { ToolDef } from "@/platform/agent/types";

/**
 * Mülk portföyü özeti — toplam aktif mülk, listing_type ve property_type
 * dağılımı, son eklenen 5 mülk. Emlak tabloları user_id ile filtrelenir
 * (her danışman kendi portföyünü tutar; tenant_id ek güvenlik katmanı değil).
 */
export const readPortfolioOverviewTool: ToolDef = {
  name: "read_portfolio_overview",
  description:
    "Emlak portföyünün özetini döner: toplam aktif mülk sayısı, listing_type (satılık/kiralık) ve property_type (daire/villa/arsa vb.) dağılımı, son eklenen 5 mülk. 'Portföyüm', 'kaç mülküm var', 'son ne ekledim' sorularında kullan.",
  input_schema: {
    type: "object",
    properties: {
      listing_type: {
        type: "string",
        enum: ["satilik", "kiralik"],
        description: "Opsiyonel filtre — sadece satılık veya kiralık.",
      },
      property_type: {
        type: "string",
        description: "Opsiyonel — daire, villa, arsa, dükkan vb.",
      },
    },
  },
  async handler(input, ctx) {
    const listingType = typeof input.listing_type === "string" ? input.listing_type : null;
    const propertyType = typeof input.property_type === "string" ? input.property_type : null;

    let countQuery = ctx.sb
      .from("emlak_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .neq("status", "deleted");
    if (listingType) countQuery = countQuery.eq("listing_type", listingType);
    if (propertyType) countQuery = countQuery.eq("type", propertyType);

    const [totalRes, breakdownRes, recentRes] = await Promise.all([
      countQuery,
      ctx.sb
        .from("emlak_properties")
        .select("listing_type, type, status")
        .eq("user_id", ctx.userId)
        .neq("status", "deleted"),
      ctx.sb
        .from("emlak_properties")
        .select("id, title, type, listing_type, price, location_neighborhood, created_at, status")
        .eq("user_id", ctx.userId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const byListingType: Record<string, number> = {};
    const byPropertyType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const row of (breakdownRes.data || []) as Array<{ listing_type: string | null; type: string | null; status: string | null }>) {
      if (row.listing_type) byListingType[row.listing_type] = (byListingType[row.listing_type] || 0) + 1;
      if (row.type) byPropertyType[row.type] = (byPropertyType[row.type] || 0) + 1;
      if (row.status) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }

    return {
      total_active: totalRes.count || 0,
      by_listing_type: byListingType,
      by_property_type: byPropertyType,
      by_status: byStatus,
      recent: (recentRes.data || []).map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        listing_type: p.listing_type,
        price_TRY: p.price ? Number(p.price) : null,
        neighborhood: p.location_neighborhood,
        status: p.status,
        created_at: p.created_at,
      })),
    };
  },
};
