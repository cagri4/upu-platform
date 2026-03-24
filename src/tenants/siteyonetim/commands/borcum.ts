/**
 * /borcum — Sakin borc durumu sorgulama
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getResidentContext, formatTL } from "./helpers";

export async function handleBorcum(ctx: WaContext): Promise<void> {
  try {
    const rc = await getResidentContext(ctx.userId);
    if (!rc) {
      await sendButtons(ctx.phone, "Borc sorgulamak icin bir daireye bagli olmaniz gerekiyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();

    const { data: dues } = await supabase
      .from("sy_dues_ledger")
      .select("period, amount, paid_amount, is_paid, late_charge_kurus")
      .eq("unit_id", rc.unit.id)
      .eq("is_paid", false)
      .order("period", { ascending: true });

    if (!dues || dues.length === 0) {
      await sendButtons(
        ctx.phone,
        `Borc Durumu -- Daire ${rc.unit.unit_number}\n\nOdenmemis borcunuz bulunmamaktadir.`,
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    let reply = `Borc Durumu -- Daire ${rc.unit.unit_number}\n\n`;
    let totalDebt = 0;
    let totalLate = 0;

    for (const d of dues) {
      const remaining = d.amount - d.paid_amount;
      totalDebt += remaining;
      totalLate += d.late_charge_kurus || 0;
      reply += `${d.period}: ${formatTL(remaining)}`;
      if (d.late_charge_kurus > 0) reply += ` (+${formatTL(d.late_charge_kurus)} gecikme)`;
      reply += "\n";
    }

    reply += `\nToplam: ${formatTL(totalDebt)}`;
    if (totalLate > 0) reply += `\nGecikme faizi: ${formatTL(totalLate)}`;

    await sendButtons(ctx.phone, reply, [{ id: "cmd:menu", title: "Ana Menu" }]);
  } catch (err) {
    console.error("[sy:borcum] error:", err);
    await sendText(ctx.phone, "Borc bilgisi sorgulanirken hata olustu. Tekrar deneyin.");
  }
}
