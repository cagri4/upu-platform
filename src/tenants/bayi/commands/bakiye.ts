/**
 * /bakiye — Bayi bakiyeleri
 * /faturalar — Son faturalar
 * /borcdurum — Vadesi gecen/yaklasan borclar
 * /ekstre — Bayi hesap ekstresi
 * /odeme — Web panel yönlendirme
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, formatDate, shortDate, webPanelRedirect } from "./helpers";

export async function handleBakiye(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: dealers } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    if (!dealers?.length) {
      await sendButtons(ctx.phone, "💳 *Bakiyeler*\n\nAktif bayi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const { data: transactions } = await supabase
      .from("bayi_dealer_transactions")
      .select("dealer_id, amount, bayi_transaction_types!inner(balance_effect)")
      .in("dealer_id", dealers.map((d: any) => d.id));

    const balances: Record<string, number> = {};
    dealers.forEach((d: any) => { balances[d.id] = 0; });
    (transactions || []).forEach((t: any) => {
      if (balances[t.dealer_id] !== undefined) {
        const effect = t.bayi_transaction_types?.balance_effect;
        if (effect === "debit") balances[t.dealer_id] -= (t.amount || 0);
        else if (effect === "credit") balances[t.dealer_id] += (t.amount || 0);
      }
    });

    const dealerMap = new Map(dealers.map((d: any) => [d.id, d.company_name]));
    const sorted = Object.entries(balances)
      .map(([id, bal]) => ({ name: dealerMap.get(id) || "Bilinmeyen", balance: bal }))
      .sort((a, b) => a.balance - b.balance);

    const lines = sorted.map((d) => {
      const icon = d.balance >= 0 ? "🟢" : d.balance > -10000 ? "🟡" : "🔴";
      return `${icon} *${d.name}* — ${formatCurrency(d.balance)}`;
    });

    const totalDebt = sorted.filter(d => d.balance < 0).reduce((s, d) => s + d.balance, 0);

    await sendButtons(
      ctx.phone,
      `💳 *Bayi Bakiyeleri*\n\n${lines.join("\n")}\n\nToplam Alacak: ${formatCurrency(Math.abs(totalDebt))}\n\n_Detay icin /ekstre [bayi] yazin._`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:bakiye] error:", err);
    await sendText(ctx.phone, "Bakiye verisi yuklenirken bir hata olustu.");
  }
}

export async function handleFaturalar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: invoices } = await supabase
      .from("bayi_dealer_invoices")
      .select("invoice_number, invoice_date, total_amount, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .order("invoice_date", { ascending: false })
      .limit(10);

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "🧾 *Faturalar*\n\nFatura kaydi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = invoices.map((inv: any, i: number) => {
      const dealer = inv.bayi_dealers?.company_name || "Bilinmeyen";
      return `${i + 1}. #${inv.invoice_number} — ${dealer} — ${formatCurrency(inv.total_amount || 0)} — ${shortDate(inv.invoice_date)}`;
    });

    await sendButtons(ctx.phone, `🧾 *Son Faturalar*\n\n${lines.join("\n")}`, [
      { id: "cmd:ekstre", title: "Ekstre" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:faturalar] error:", err);
    await sendText(ctx.phone, "Faturalar yuklenirken bir hata olustu.");
  }
}

export async function handleBorcDurum(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date().toISOString();

    const { data: transactions } = await supabase
      .from("bayi_dealer_transactions")
      .select("dealer_id, amount, due_date, bayi_transaction_types!inner(balance_effect), bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null);

    if (!transactions?.length) {
      await sendButtons(ctx.phone, "💳 *Borc Durumu*\n\nVadeli islem bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const overdue: any[] = [];
    const upcoming: any[] = [];

    transactions.forEach((t: any) => {
      if (t.bayi_transaction_types?.balance_effect === "debit" && t.due_date) {
        if (t.due_date < now) overdue.push(t);
        else upcoming.push(t);
      }
    });

    const overdueTotal = overdue.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const upcomingTotal = upcoming.reduce((s: number, t: any) => s + (t.amount || 0), 0);

    const overdueLines = overdue.slice(0, 5).map((t: any) => {
      const dealer = t.bayi_dealers?.company_name || "Bilinmeyen";
      const days = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000);
      return `🔴 ${dealer} — ${formatCurrency(t.amount || 0)} — ${days} gun gecikme`;
    }).join("\n");

    const upcomingLines = upcoming
      .sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 5)
      .map((t: any) => {
        const dealer = t.bayi_dealers?.company_name || "Bilinmeyen";
        return `🟡 ${dealer} — ${formatCurrency(t.amount || 0)} — ${formatDate(t.due_date)}`;
      }).join("\n");

    await sendButtons(
      ctx.phone,
      `💳 *Borc Durumu Ozeti*\n\n*Vadesi Gecen:* ${formatCurrency(overdueTotal)} (${overdue.length} islem)\n${overdueLines || "Yok"}\n\n*Yaklasan Vadeler:* ${formatCurrency(upcomingTotal)} (${upcoming.length} islem)\n${upcomingLines || "Yok"}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:borcdurum] error:", err);
    await sendText(ctx.phone, "Borc durumu yuklenirken bir hata olustu.");
  }
}

export async function handleEkstre(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const args = ctx.text.replace(/^\/?\s*ekstre\s*/i, "").trim();

    if (!args) {
      await sendText(ctx.phone, "📄 *Ekstre*\n\nKullanim: /ekstre [bayi adi]\n\nOrnek: /ekstre Mehmet\n\nTum bayiler icin /bayidurum list yazin.");
      return;
    }

    const { data: dealers } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("tenant_id", ctx.tenantId)
      .ilike("company_name", `%${args}%`)
      .limit(1);

    if (!dealers?.length) {
      await sendText(ctx.phone, `📄 "${args}" isimli bayi bulunamadi.`);
      return;
    }

    const dealer = dealers[0];

    const { data: transactions } = await supabase
      .from("bayi_dealer_transactions")
      .select("amount, description, transaction_date, bayi_transaction_types!inner(name, balance_effect)")
      .eq("dealer_id", dealer.id)
      .order("transaction_date", { ascending: false })
      .limit(15);

    if (!transactions?.length) {
      await sendText(ctx.phone, `📄 *Ekstre — ${dealer.company_name}*\n\nIslem kaydi bulunmuyor.`);
      return;
    }

    let balance = 0;
    const lines = [...transactions].reverse().map((t: any) => {
      const effect = t.bayi_transaction_types?.balance_effect;
      if (effect === "debit") balance -= (t.amount || 0);
      else if (effect === "credit") balance += (t.amount || 0);
      const sign = effect === "credit" ? "+" : "-";
      return `${shortDate(t.transaction_date)} — ${t.description || t.bayi_transaction_types?.name || ""} — ${sign}${formatCurrency(t.amount || 0)}`;
    });

    await sendButtons(
      ctx.phone,
      `📄 *Hesap Ekstresi — ${dealer.company_name}*\n\n${lines.join("\n")}\n\n*Guncel Bakiye:* ${formatCurrency(balance)}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:ekstre] error:", err);
    await sendText(ctx.phone, "Ekstre yuklenirken bir hata olustu.");
  }
}

export async function handleOdeme(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "💰 *Odeme Kaydi*\nOdeme kaydi olusturmak icin web panelini kullanin.");
}
