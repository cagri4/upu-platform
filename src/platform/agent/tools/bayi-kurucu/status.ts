import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const kurucuStatusTool: ToolDef = {
  name: "kurucu_status",
  description: "Kurulum durumunu döner: bayi sayısı, ürün sayısı, branding kurulu mu, HAZIR mı (=bayi≥1 + ürün≥1). Her sohbet başında ve büyük adımlardan sonra çağır.",
  expectedTenantKey: "bayi",
  input_schema: { type: "object", properties: {} },
  async handler(_input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_status");
    const [dealersRes, productsRes, brandingRes] = await Promise.all([
      ctx.sb.from("bayi_dealers").select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId),
      ctx.sb.from("bayi_products").select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId),
      ctx.sb.from("bayi_tenant_branding").select("tenant_id").eq("tenant_id", ctx.tenantId).maybeSingle(),
    ]);
    const dealer_count = dealersRes.count || 0;
    const product_count = productsRes.count || 0;
    const has_branding = !!brandingRes.data;
    const is_ready = dealer_count > 0 && product_count > 0;
    return {
      dealer_count,
      product_count,
      has_branding,
      is_ready,
      next_step_suggestion: is_ready
        ? "Sistem hazır — kullanıcıya ilk siparişi vermesi/test etmesi için yönlendir."
        : dealer_count === 0
          ? "İlk öncelik: bayi listesi. 5 ray yöntemini öner, hangisini istediğini sor."
          : "Ürün katalogu eksik. 5 ray yöntemini ürünler için öner.",
    };
  },
};
