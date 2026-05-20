import type { ToolDef } from "@/platform/agent/types";

/**
 * Aktif takipler — emlak_tracking_criteria (kullanıcının açtığı arama
 * kriterleri). Her takip: mahalle filtresi, property type'lar, fiyat range.
 * Müşteri-mülk eşleşme önerilerinde takip kriterleri base oluşturur.
 */
export const readTrackingActiveTool: ToolDef = {
  name: "read_tracking_active",
  description:
    "Aktif takip kriterlerini döner: müşteri için açılmış arama kriterleri (mahalle, property type, fiyat aralığı). Toplam aktif takip + son 10 detay. 'Bugün takipte ne var', 'kim hangi mülkü arıyor', 'aktif takiplerim' soruları için.",
  input_schema: {
    type: "object",
    properties: {},
  },
  async handler(_input, ctx) {
    const { data, count } = await ctx.sb
      .from("emlak_tracking_criteria")
      .select("id, name, neighborhoods, property_types, listing_type, price_min, price_max, active, created_at", { count: "exact" })
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = (data || []) as Array<{
      id: string;
      name: string | null;
      neighborhoods: string[] | null;
      property_types: string[] | null;
      listing_type: string | null;
      price_min: number | null;
      price_max: number | null;
      active: boolean;
      created_at: string;
    }>;

    return {
      active_count: count || 0,
      trackings: rows.map((t) => ({
        id: t.id,
        name: t.name,
        listing_type: t.listing_type,
        property_types: t.property_types || [],
        neighborhoods: t.neighborhoods || [],
        price_min_TRY: t.price_min,
        price_max_TRY: t.price_max,
        created_at: t.created_at,
      })),
    };
  },
};
