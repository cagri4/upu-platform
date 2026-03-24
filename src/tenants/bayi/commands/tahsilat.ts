/**
 * /vadeler — Vadesi gelen/gecen ödemeler
 * /tahsilat — Tahsilat durumu takibi
 * /hatirlatgonder — Web panel yönlendirme
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, formatDate, webPanelRedirect } from "./helpers";

export async function handleVadeler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: transactions } = await supabase
      .from("bayi_dealer_transactions")
      .select("amount, due_date, bayi_dealers!inner(company_name), bayi_transaction_types!inner(balance_effect)")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(20);

    if (!transactions?.length) {
      await sendButtons(ctx.phone, "⏰ *Vadeler*\n\nVadeli islem bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const overdue: string[] = [];
    const todayVade: string[] = [];
    const upcoming: string[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    transactions.forEach((t: any) => {
      if (t.bayi_transaction_types?.balance_effect !== "debit") return;
      const dealer = t.bayi_dealers?.company_name || "Bilinmeyen";
      const line = `${dealer} — ${formatCurrency(t.amount || 0)} — ${formatDate(t.due_date)}`;
      const dueStr = (t.due_date || "").split("T")[0] || t.due_date;

      if (dueStr < todayStr) overdue.push(`🔴 ${line}`);
      else if (dueStr === todayStr) todayVade.push(`🟡 ${line}`);
      else upcoming.push(`🟢 ${line}`);
    });

    const sections = [];
    if (overdue.length) sections.push(`*Vadesi Gecen (${overdue.length})*\n${overdue.join("\n")}`);
    if (todayVade.length) sections.push(`*Vadesi Bugun (${todayVade.length})*\n${todayVade.join("\n")}`);
    if (upcoming.length) sections.push(`*Onumuzdeki Vadeler (${upcoming.length})*\n${upcoming.join("\n")}`);

    await sendButtons(
      ctx.phone,
      `⏰ *Vadesi Gelen/Gecen Odemeler*\n\n${sections.join("\n\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:vadeler] error:", err);
    await sendText(ctx.phone, "Vade verisi yuklenirken bir hata olustu.");
  }
}

export async function handleTahsilat(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: activities } = await supabase
      .from("bayi_collection_activities")
      .select("activity_type, notes, amount_expected, due_date, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .order("due_date", { ascending: false })
      .limit(15);

    if (!activities?.length) {
      await sendButtons(ctx.phone, "💳 *Tahsilat*\n\nTahsilat kaydi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = activities.map((a: any, i: number) => {
      const dealer = a.bayi_dealers?.company_name || "Bilinmeyen";
      const amount = a.amount_expected ? formatCurrency(a.amount_expected) : "Belirtilmemis";
      const date = a.due_date ? formatDate(a.due_date) : "";
      return `${i + 1}. ${dealer} — ${amount} — ${a.activity_type || "Tahsilat"}\n   ${date}${a.notes ? " | " + a.notes : ""}`;
    });

    await sendButtons(
      ctx.phone,
      `💳 *Tahsilat Durumlari*\n\n${lines.join("\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:tahsilat] error:", err);
    await sendText(ctx.phone, "Tahsilat verisi yuklenirken bir hata olustu.");
  }
}

export async function handleHatirlatGonder(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "📩 *Odeme Hatirlatmasi*\nHatirlatma gondermek icin web panelini kullanin.");
}
