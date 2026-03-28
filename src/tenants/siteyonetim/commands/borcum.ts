/**
 * /borcum — Borç durumu sorgulama
 *
 * Manager/staff: tüm binanın ödenmemiş borç özeti (daire bazlı)
 * Resident (unit bağlantısı varsa): kendi dairesinin borcu
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getStaffContext, formatTL } from "./helpers";

export async function handleBorcum(ctx: WaContext): Promise<void> {
  try {
    const sc = await getStaffContext(ctx.userId);
    if (!sc) {
      await sendButtons(ctx.phone, "Bir binaya baglanmaniz gerekiyor. Yoneticinize basvurun.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();

    // Staff/manager: show all building dues
    const { data: dues } = await supabase
      .from("sy_dues_ledger")
      .select("unit_id, period, amount, paid_amount, is_paid, late_charge_kurus, sy_units!inner(unit_number)")
      .eq("building_id", sc.building.id)
      .eq("is_paid", false)
      .order("period", { ascending: true });

    if (!dues || dues.length === 0) {
      await sendButtons(
        ctx.phone,
        `${sc.building.name} -- Borc Durumu\n\nTum aidatlar odenmis, borclu daire yok.`,
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    // Group by unit
    const byUnit: Record<string, { unitNum: string; total: number; late: number; count: number }> = {};
    for (const d of dues) {
      const unitNum = (d as any).sy_units?.unit_number || "?";
      const key = d.unit_id;
      if (!byUnit[key]) byUnit[key] = { unitNum, total: 0, late: 0, count: 0 };
      byUnit[key].total += d.amount - d.paid_amount;
      byUnit[key].late += d.late_charge_kurus || 0;
      byUnit[key].count++;
    }

    let totalDebt = 0;
    let totalLate = 0;
    const lines: string[] = [];

    for (const u of Object.values(byUnit)) {
      totalDebt += u.total;
      totalLate += u.late;
      let line = `Daire ${u.unitNum}: ${formatTL(u.total)} (${u.count} donem)`;
      if (u.late > 0) line += ` +${formatTL(u.late)} gecikme`;
      lines.push(line);
    }

    // Limit to 15 lines
    const displayLines = lines.slice(0, 15);
    const more = lines.length > 15 ? `\n...ve ${lines.length - 15} daire daha` : "";

    let reply = `${sc.building.name} -- Borc Durumu\n\n`;
    reply += displayLines.join("\n");
    reply += more;
    reply += `\n\nBorclu Daire: ${Object.keys(byUnit).length}`;
    reply += `\nToplam Borc: ${formatTL(totalDebt)}`;
    if (totalLate > 0) reply += `\nGecikme Faizi: ${formatTL(totalLate)}`;

    await sendButtons(ctx.phone, reply, [
      { id: "cmd:aidat", title: "Aidat Detay" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[sy:borcum] error:", err);
    await sendText(ctx.phone, "Borc bilgisi sorgulanirken hata olustu. Tekrar deneyin.");
  }
}
