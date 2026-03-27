/**
 * /eslestir — Match customers with properties
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", mustakil: "Mustakil", rezidans: "Rezidans",
  arsa: "Arsa", isyeri: "Isyeri", dukkan: "Dukkan",
};

function fmtPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M TL`;
  if (price >= 1_000) return `${Math.round(price / 1_000)}K TL`;
  return `${price} TL`;
}

export async function handleEslestir(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const args = ctx.text.split(" ").slice(1).join(" ").trim();

  if (args) {
    // Search by name
    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, budget_min, budget_max, location, property_type, rooms")
      .eq("user_id", ctx.userId)
      .ilike("name", `%${args}%`)
      .limit(1);

    if (customers && customers.length > 0) {
      await runMatching(ctx, customers[0]);
      return;
    }
    await sendButtons(ctx.phone, `"${args}" adinda musteri bulunamadi.`, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  // No args — show customer list
  const { data: customers } = await supabase
    .from("emlak_customers")
    .select("id, name, phone")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!customers || customers.length === 0) {
    await sendButtons(ctx.phone, "Henuz musteriniz yok. /musteriEkle ile ekleyin.", [
      { id: "cmd:musteriEkle", title: "Musteri Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = customers.map(c => ({
    id: `esles:${c.id}`,
    title: ((c.name || "Isimsiz") as string).substring(0, 24),
    description: (c.phone as string) || "",
  }));

  await sendList(ctx.phone, "👤 Hangi musteri icin eslestirme yapayim?", "Musteri Sec", [
    { title: "Musteriler", rows },
  ]);
}

export async function handleEslestirCallback(ctx: WaContext, data: string): Promise<void> {
  const customerId = data.replace("esles:", "");
  const supabase = getServiceClient();

  const { data: customer } = await supabase
    .from("emlak_customers")
    .select("id, name, budget_min, budget_max, location, property_type, rooms")
    .eq("id", customerId)
    .eq("user_id", ctx.userId)
    .single();

  if (!customer) {
    await sendButtons(ctx.phone, "Musteri bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  await sendText(ctx.phone, `🔍 ${customer.name} icin eslestirme yapiliyor...`);
  await runMatching(ctx, customer);
}

async function runMatching(ctx: WaContext, customer: Record<string, unknown>): Promise<void> {
  const supabase = getServiceClient();
  const budgetMin = customer.budget_min ? Number(customer.budget_min) : null;
  const budgetMax = customer.budget_max ? Number(customer.budget_max) : null;
  const location = (customer.location as string) || "";
  const prefType = (customer.property_type as string) || "";
  const prefRooms = (customer.rooms as string) || "";

  let query = supabase
    .from("emlak_properties")
    .select("id, title, price, type, listing_type, rooms, area, location_city, location_district")
    .eq("status", "aktif")
    .gt("price", 0);

  if (budgetMin) query = query.gte("price", budgetMin * 0.8);
  if (budgetMax) query = query.lte("price", budgetMax * 1.2);
  if (prefType) query = query.eq("type", prefType);

  const { data: properties } = await query.order("price", { ascending: true }).limit(50);

  if (!properties || properties.length === 0) {
    await sendButtons(ctx.phone,
      `${customer.name} icin uygun mulk bulunamadi.\n\nButce: ${budgetMin ? fmtPrice(budgetMin) : "?"} — ${budgetMax ? fmtPrice(budgetMax) : "?"}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  // Score each property
  type ScoredProp = (typeof properties)[0] & { score: number; reasons: string[] };
  const scored: ScoredProp[] = properties.map(p => {
    let score = 0;
    const reasons: string[] = [];

    // Budget match (+2)
    if (p.price > 0 && (budgetMin || budgetMax)) {
      const inBudget = (!budgetMin || p.price >= budgetMin) && (!budgetMax || p.price <= budgetMax);
      if (inBudget) { score += 2; reasons.push("💰 Butce uygun"); }
    }

    // Location match (+2)
    if (location) {
      const locs = location.split(",").map(l => l.trim().toLowerCase());
      const propLoc = [p.location_district, p.location_city].filter(Boolean).join(" ").toLowerCase();
      if (locs.some(l => propLoc.includes(l))) { score += 2; reasons.push("📍 Lokasyon uygun"); }
    }

    // Type match (+1)
    if (prefType && p.type === prefType) { score += 1; reasons.push("🏠 Tip uygun"); }

    // Room match (+1)
    if (prefRooms && p.rooms === prefRooms) { score += 1; reasons.push("🛏 Oda uygun"); }

    return { ...p, score, reasons };
  });

  const matches = scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  if (matches.length === 0) {
    await sendButtons(ctx.phone,
      `${customer.name} icin uygun mulk bulunamadi.\n\nPortfoyunuze daha fazla mulk eklemek icin /mulkekle yazin.`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
    return;
  }

  const stars = (s: number) => "⭐".repeat(Math.min(s, 5));

  let text = `🔍 *${customer.name}* icin eslesmeler\n📊 ${properties.length} ilan tarandi\n\n`;
  for (const [i, p] of matches.entries()) {
    const priceStr = p.price > 0 ? fmtPrice(p.price) : "—";
    const loc = [p.location_district, p.location_city].filter(Boolean).join(", ");
    text += `${i + 1}. ${p.title || "Isimsiz"}\n`;
    text += `   ${priceStr} | ${p.rooms || "—"} | ${loc}\n`;
    text += `   ${stars(p.score)} (${p.score}/6) ${p.reasons.join(" ")}\n\n`;
  }

  await sendButtons(ctx.phone, text, [
    { id: "cmd:musterilerim", title: "Musterilerim" },
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}
