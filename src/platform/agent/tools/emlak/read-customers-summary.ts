import type { ToolDef } from "@/platform/agent/types";

/**
 * Aktif müşteri özeti — toplam ve aktif sayısı, arama tipine göre
 * (satılık arayanlar/kiralık arayanlar), pipeline_stage dağılımı, son 5
 * müşteri (ad/telefon/aradığı tür).
 */
export const readCustomersSummaryTool: ToolDef = {
  name: "read_customers_summary",
  description:
    "Aktif müşteri portföyünün özetini döner: toplam müşteri, arama tipine göre dağılım (satılık arayanlar / kiralık arayanlar), pipeline aşaması, son 5 müşteri. 'Müşterilerim', 'kim arıyor', 'kaç müşterim var' soruları için.",
  input_schema: {
    type: "object",
    properties: {
      looking_for: {
        type: "string",
        enum: ["satilik", "kiralik"],
        description: "Opsiyonel — sadece satılık veya kiralık arayanlar.",
      },
    },
  },
  async handler(input, ctx) {
    const lookingFor = typeof input.looking_for === "string" ? input.looking_for : null;

    let listQuery = ctx.sb
      .from("emlak_customers")
      .select("id, name, phone, looking_for, listing_type, property_type, budget_min, budget_max, location, pipeline_stage, status, created_at")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (lookingFor) {
      // looking_for sütunu array veya listing_type stringi olarak gelebilir
      listQuery = listQuery.or(`listing_type.eq.${lookingFor},looking_for.cs.{${lookingFor}}`);
    }
    const { data: rows } = await listQuery;

    const list = (rows || []) as Array<{
      id: string;
      name: string | null;
      phone: string | null;
      looking_for: string[] | null;
      listing_type: string | null;
      property_type: string | null;
      budget_min: number | null;
      budget_max: number | null;
      location: string | null;
      pipeline_stage: string | null;
      status: string | null;
      created_at: string;
    }>;

    const byListingType: Record<string, number> = { satilik: 0, kiralik: 0, hepsi: 0 };
    const byStage: Record<string, number> = {};
    const byPropertyType: Record<string, number> = {};
    let activeCount = 0;

    for (const c of list) {
      const lf: string[] = Array.isArray(c.looking_for) && c.looking_for.length > 0
        ? c.looking_for
        : c.listing_type === "hepsi" ? ["satilik", "kiralik"]
        : c.listing_type ? [c.listing_type]
        : [];
      if (lf.length === 2) byListingType.hepsi++;
      else if (lf[0] === "satilik") byListingType.satilik++;
      else if (lf[0] === "kiralik") byListingType.kiralik++;
      if (c.pipeline_stage) byStage[c.pipeline_stage] = (byStage[c.pipeline_stage] || 0) + 1;
      if (c.property_type) byPropertyType[c.property_type] = (byPropertyType[c.property_type] || 0) + 1;
      if (c.status === "active" || c.status == null) activeCount++;
    }

    return {
      total: list.length,
      active: activeCount,
      by_listing_type: byListingType,
      by_pipeline_stage: byStage,
      by_property_type: byPropertyType,
      recent: list.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        looking_for: Array.isArray(c.looking_for) && c.looking_for.length
          ? c.looking_for
          : c.listing_type ? [c.listing_type] : [],
        budget_min_TRY: c.budget_min,
        budget_max_TRY: c.budget_max,
        location: c.location,
        pipeline_stage: c.pipeline_stage,
        created_at: c.created_at,
      })),
    };
  },
};
