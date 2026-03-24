/**
 * /bayidurum — Bayi listesi veya tek bayi detayı
 * /ziyaretler — Planlı ziyaret listesi
 * /ziyaretnotu — Web panel yönlendirme
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, formatDate, webPanelRedirect } from "./helpers";

export async function handleBayiDurum(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const args = ctx.text.replace(/^\/?\s*bayidurum\s*/i, "").trim();

    // No args or "list" → show all dealers
    if (!args || args.toLowerCase() === "list") {
      const { data: dealers } = await supabase
        .from("bayi_dealers")
        .select("id, company_name, email, phone, is_active")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .order("company_name")
        .limit(15);

      if (!dealers?.length) {
        await sendButtons(ctx.phone, "👤 *Bayi Listesi*\n\nAktif bayi bulunmuyor.", [
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      const lines = dealers.map((d: any, i: number) =>
        `${i + 1}. *${d.company_name}*\n   📞 ${d.phone || "Yok"} | ${d.email || "Yok"}`,
      );
      await sendButtons(ctx.phone, `👤 *Aktif Bayiler*\n\n${lines.join("\n")}\n\n_Detay icin /bayidurum [isim] yazin._`, [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Search for specific dealer
    const { data: dealers } = await supabase
      .from("bayi_dealers")
      .select("id, company_name, email, phone, is_active")
      .eq("tenant_id", ctx.tenantId)
      .ilike("company_name", `%${args}%`)
      .limit(1);

    if (!dealers?.length) {
      await sendText(ctx.phone, `👤 "${args}" isimli bayi bulunamadi.\n\nTum bayiler icin /bayidurum list yazin.`);
      return;
    }

    const dealer = dealers[0];

    const [ordersRes, txRes, visitsRes] = await Promise.all([
      supabase
        .from("bayi_orders")
        .select("order_number, total_amount, created_at, bayi_order_statuses!inner(name)")
        .eq("dealer_id", dealer.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("bayi_dealer_transactions")
        .select("amount, transaction_type_id, bayi_transaction_types!inner(balance_effect)")
        .eq("dealer_id", dealer.id),
      supabase
        .from("bayi_dealer_visits")
        .select("planned_date, visit_type, outcome")
        .eq("dealer_id", dealer.id)
        .order("planned_date", { ascending: false })
        .limit(3),
    ]);

    const recentOrders = ordersRes.data || [];
    const transactions = txRes.data || [];
    const visits = visitsRes.data || [];

    let balance = 0;
    transactions.forEach((t: any) => {
      const effect = t.bayi_transaction_types?.balance_effect;
      if (effect === "debit") balance -= (t.amount || 0);
      else if (effect === "credit") balance += (t.amount || 0);
    });

    const orderLines = recentOrders.length
      ? recentOrders.map((o: any) => `#${o.order_number} — ${formatCurrency(o.total_amount || 0)} — ${o.bayi_order_statuses?.name || ""}`).join("\n")
      : "Siparis yok";

    const visitLines = visits.length
      ? visits.map((v: any) => `${formatDate(v.planned_date)} — ${v.visit_type || "Ziyaret"} ${v.outcome ? "(" + v.outcome + ")" : ""}`).join("\n")
      : "Ziyaret kaydi yok";

    await sendButtons(
      ctx.phone,
      `👤 *Bayi Durum — ${dealer.company_name}*\n\n📞 ${dealer.phone || "Yok"}\n📧 ${dealer.email || "Yok"}\n💳 Bakiye: ${formatCurrency(balance)}\n\n*Son Siparisler:*\n${orderLines}\n\n*Son Ziyaretler:*\n${visitLines}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:bayidurum] error:", err);
    await sendText(ctx.phone, "Bayi durumu yuklenirken bir hata olustu.");
  }
}

export async function handleZiyaretler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    const { data: visits } = await supabase
      .from("bayi_dealer_visits")
      .select("planned_date, visit_type, outcome, notes, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .gte("planned_date", now.toISOString())
      .order("planned_date", { ascending: true })
      .limit(10);

    if (!visits?.length) {
      await sendButtons(ctx.phone, "📅 *Bayi Ziyaretleri*\n\nPlanlanmis ziyaret bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = visits.map((v: any, i: number) => {
      const date = new Date(v.planned_date);
      const day = date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "short" });
      const dealer = v.bayi_dealers?.company_name || "Bilinmeyen";
      return `${i + 1}. ${day} — ${dealer}\n   ${v.visit_type || "Rutin"}${v.notes ? " — " + v.notes : ""}`;
    });

    await sendButtons(
      ctx.phone,
      `📅 *Planli Ziyaretler*\n\n${lines.join("\n\n")}\n\nToplam: ${visits.length} ziyaret`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:ziyaretler] error:", err);
    await sendText(ctx.phone, "Ziyaretler yuklenirken bir hata olustu.");
  }
}

export async function handleZiyaretNotu(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "📝 *Ziyaret Notu*\nZiyaret notu eklemek icin web panelini kullanin.");
}
