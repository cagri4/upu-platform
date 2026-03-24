/**
 * /takvim — İş programı ve randevular (gelecek 7 gün)
 * /hatirlatma — Aktif hatırlatmalar
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { today, formatCurrency, formatDate } from "./helpers";

export async function handleTakvim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const weekLater = new Date(now);
    weekLater.setDate(weekLater.getDate() + 7);

    const { data: visits } = await supabase
      .from("bayi_dealer_visits")
      .select("planned_date, visit_type, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .gte("planned_date", now.toISOString())
      .lte("planned_date", weekLater.toISOString())
      .order("planned_date", { ascending: true })
      .limit(10);

    if (!visits?.length) {
      await sendButtons(ctx.phone, `📅 *Takvim — ${today()}*\n\nOnumuzdeki 7 gun icin planlanmis ziyaret bulunmuyor.`, [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = visits.map((v: any) => {
      const date = new Date(v.planned_date);
      const time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const day = date.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
      const dealer = v.bayi_dealers?.company_name || "Bilinmeyen";
      return `${day} ${time} — ${dealer} (${v.visit_type || "Ziyaret"})`;
    });

    await sendButtons(
      ctx.phone,
      `📅 *Takvim — ${today()}*\n\n${lines.join("\n")}\n\nToplam: ${visits.length} planli ziyaret`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:takvim] error:", err);
    await sendText(ctx.phone, "Takvim yuklenirken bir hata olustu.");
  }
}

export async function handleHatirlatma(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: activities } = await supabase
      .from("bayi_collection_activities")
      .select("activity_type, notes, amount_expected, due_date, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .order("due_date", { ascending: true })
      .limit(10);

    if (!activities?.length) {
      await sendButtons(ctx.phone, "⏰ *Hatirlatmalar*\n\nAktif hatirlatma bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = activities.map((a: any, i: number) => {
      const dealer = a.bayi_dealers?.company_name || "Bilinmeyen";
      const amount = a.amount_expected ? ` — ${formatCurrency(a.amount_expected)}` : "";
      const date = a.due_date ? ` (${formatDate(a.due_date)})` : "";
      return `${i + 1}. ${dealer}${amount}${date}\n   ${a.activity_type || ""} ${a.notes ? "— " + a.notes : ""}`;
    });

    await sendButtons(ctx.phone, `⏰ *Hatirlatmalar*\n\n${lines.join("\n\n")}`, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:hatirlatma] error:", err);
    await sendText(ctx.phone, "Hatirlatmalar yuklenirken bir hata olustu.");
  }
}
