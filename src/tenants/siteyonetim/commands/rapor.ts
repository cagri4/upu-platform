/**
 * /rapor — Yonetici KPI raporu (borclu daire, acik ariza, net nakit)
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getManagerContext, formatTL } from "./helpers";

export async function handleRapor(ctx: WaContext): Promise<void> {
  try {
    const mc = await getManagerContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bu komut sadece yoneticiler icindir.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();
    const buildingId = mc.building.id;

    // Unpaid dues count
    const { count: debtorCount } = await supabase
      .from("sy_dues_ledger")
      .select("id", { count: "exact", head: true })
      .eq("building_id", buildingId)
      .eq("is_paid", false);

    // Open tickets count
    const { count: openTickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id", { count: "exact", head: true })
      .eq("building_id", buildingId)
      .eq("status", "acik");

    // Income vs expense
    const { data: cashRows } = await supabase
      .from("sy_income_expenses")
      .select("type, amount_kurus")
      .eq("building_id", buildingId);

    let income = 0;
    let expense = 0;
    for (const row of cashRows || []) {
      if (row.type === "income") income += row.amount_kurus;
      else if (row.type === "expense") expense += row.amount_kurus;
    }

    await sendButtons(
      ctx.phone,
      `${mc.building.name} -- Rapor\n\nBorclu Daire: ${debtorCount ?? 0}\nAcik Ariza: ${openTickets ?? 0}\nNet Nakit: ${formatTL(income - expense)}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:rapor] error:", err);
    await sendText(ctx.phone, "Rapor yuklenirken hata olustu.");
  }
}
