/**
 * /aidat — Yonetici aidat ozeti (tum binanin aidat durumu)
 * /gelir_gider — Yonetici gelir-gider tablosu
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getManagerContext, formatTL } from "./helpers";

export async function handleAidat(ctx: WaContext): Promise<void> {
  try {
    const mc = await getManagerContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bu komut sadece yoneticiler icindir.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();

    // Get all unpaid dues with unit info
    const { data: dues } = await supabase
      .from("sy_dues_ledger")
      .select("unit_id, amount, paid_amount, period, sy_units!inner(unit_number)")
      .eq("building_id", mc.building.id)
      .eq("is_paid", false)
      .order("period", { ascending: true });

    if (!dues || dues.length === 0) {
      await sendButtons(ctx.phone, `${mc.building.name} -- Aidat Durumu\n\nTum aidatlar odenmis.`, [
        { id: "cmd:rapor", title: "Rapor" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    let totalUnpaid = 0;
    const lines = dues.slice(0, 15).map((d: any) => {
      const remaining = d.amount - d.paid_amount;
      totalUnpaid += remaining;
      const unitNum = d.sy_units?.unit_number || "?";
      return `Daire ${unitNum} - ${d.period}: ${formatTL(remaining)}`;
    });

    const more = dues.length > 15 ? `\n...ve ${dues.length - 15} kayit daha` : "";

    await sendButtons(
      ctx.phone,
      `${mc.building.name} -- Odenmemis Aidatlar\n\n${lines.join("\n")}${more}\n\nToplam: ${formatTL(totalUnpaid)}`,
      [{ id: "cmd:rapor", title: "Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:aidat] error:", err);
    await sendText(ctx.phone, "Aidat bilgisi yuklenirken hata olustu.");
  }
}

export async function handleGelirGider(ctx: WaContext): Promise<void> {
  try {
    const mc = await getManagerContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bu komut sadece yoneticiler icindir.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();

    const { data: rows } = await supabase
      .from("sy_income_expenses")
      .select("type, category, description, amount_kurus, period")
      .eq("building_id", mc.building.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!rows || rows.length === 0) {
      await sendButtons(ctx.phone, `${mc.building.name} -- Gelir/Gider\n\nHenuz kayit bulunmuyor.`, [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    let totalIncome = 0;
    let totalExpense = 0;
    const lines: string[] = [];

    for (const r of rows) {
      const sign = r.type === "income" ? "+" : "-";
      const icon = r.type === "income" ? "+" : "-";
      if (r.type === "income") totalIncome += r.amount_kurus;
      else totalExpense += r.amount_kurus;
      lines.push(`${icon} ${r.category} (${r.period}): ${formatTL(r.amount_kurus)} -- ${r.description}`);
    }

    await sendButtons(
      ctx.phone,
      `${mc.building.name} -- Gelir/Gider\n\n${lines.join("\n")}\n\nGelir: ${formatTL(totalIncome)}\nGider: ${formatTL(totalExpense)}\nNet: ${formatTL(totalIncome - totalExpense)}`,
      [{ id: "cmd:rapor", title: "Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:gelir_gider] error:", err);
    await sendText(ctx.phone, "Gelir-gider bilgisi yuklenirken hata olustu.");
  }
}
