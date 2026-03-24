/**
 * Tahsilat Uzmani commands:
 * /alacaklar — Alacak listesi
 * /geciken — Vadesi gecen odemeler
 * /hatirlatma_gonder — Odeme hatirlatmasi gonder (multi-step)
 * /odeme_ekle — Odeme kaydi ekle (multi-step)
 * /nakit_akis — Nakit akis raporu
 * /risk — Mukellef risk analizi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { formatCurrency, formatDate, todayISO } from "./helpers";

// ── alacaklar ─────────────────────────────────────────────────────────

export async function handleAlacaklar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: invoices, error } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, due_date, invoice_no")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[muhasebe:alacaklar] error:", error);
      await sendText(ctx.phone, "Alacaklar yuklenirken bir hata olustu.");
      return;
    }

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Kayitli alacak bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const total = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

    const lines = invoices.map((inv: any, i: number) => {
      const vendor = inv.vendor_name || "Bilinmeyen";
      const amount = inv.amount != null ? formatCurrency(Number(inv.amount)) : "-";
      const due = inv.due_date ? formatDate(inv.due_date) : "-";
      return `${i + 1}. ${vendor} — ${amount} (Vade: ${due})`;
    });

    await sendButtons(
      ctx.phone,
      `*Alacaklar* (${invoices.length} kayit)\n\n${lines.join("\n")}\n\nToplam: ${formatCurrency(total)}`,
      [
        { id: "cmd:geciken", title: "Geciken" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:alacaklar] error:", err);
    await sendText(ctx.phone, "Alacaklar yuklenirken bir hata olustu.");
  }
}

// ── geciken ───────────────────────────────────────────────────────────

export async function handleGeciken(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();

    const { data: invoices, error } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, due_date, invoice_no")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[muhasebe:geciken] error:", error);
      await sendText(ctx.phone, "Geciken odemeler yuklenirken bir hata olustu.");
      return;
    }

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Geciken odeme bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = invoices.map((inv: any, i: number) => {
      const vendor = inv.vendor_name || "Bilinmeyen";
      const amount = inv.amount != null ? formatCurrency(Number(inv.amount)) : "-";
      const dueDate = inv.due_date || "-";

      let daysOverdue = "";
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        daysOverdue = ` (${diffDays} gun gecikme)`;
      }

      return `${i + 1}. ${vendor} — ${amount}\n   Vade: ${formatDate(dueDate)}${daysOverdue}`;
    });

    const total = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

    await sendButtons(
      ctx.phone,
      `*Geciken Odemeler* (${invoices.length})\n\n${lines.join("\n")}\n\nToplam geciken: ${formatCurrency(total)}`,
      [
        { id: "cmd:hatirlatma_gonder", title: "Hatirlatma Gonder" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:geciken] error:", err);
    await sendText(ctx.phone, "Geciken odemeler yuklenirken bir hata olustu.");
  }
}

// ── hatirlatma_gonder (multi-step) ────────────────────────────────────

export async function handleHatirlatmaGonder(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();

    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, due_date")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5);

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Geciken odeme bulunmuyor, hatirlatma gonderilecek kayit yok.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = invoices.map((inv: any, i: number) => {
      const vendor = inv.vendor_name || "Bilinmeyen";
      const amount = inv.amount != null ? formatCurrency(Number(inv.amount)) : "-";
      return `${i + 1}. ${vendor} — ${amount} (Vade: ${inv.due_date ? formatDate(inv.due_date) : "-"})`;
    });

    await startSession(ctx.userId, ctx.tenantId, "hatirlatma_gonder", "waiting_selection", );
    // Store invoice list in session via updateSession
    await updateSession(ctx.userId, "waiting_selection", {
      invoices: invoices.map((inv: any) => ({
        id: inv.id,
        vendor: inv.vendor_name,
        amount: inv.amount,
      })),
    });

    await sendText(
      ctx.phone,
      `*Hatirlatma Gonder*\n\nBir fatura secin:\n\n${lines.join("\n")}\n\nFatura numarasini yazin (1-${invoices.length}):`,
    );
  } catch (err) {
    console.error("[muhasebe:hatirlatma_gonder] error:", err);
    await sendText(ctx.phone, "Hatirlatma gonderme hazirlanirken bir hata olustu.");
  }
}

export async function stepHatirlatmaGonder(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;
  const invoices = (data.invoices as Array<{ id: string; vendor: string; amount: number }>) || [];

  if (session.current_step === "waiting_selection") {
    const selection = parseInt(ctx.text.trim(), 10);

    if (isNaN(selection) || selection < 1 || selection > invoices.length) {
      await sendText(ctx.phone, `Lutfen 1-${invoices.length} arasi bir numara girin:`);
      return;
    }

    const selected = invoices[selection - 1];
    await updateSession(ctx.userId, "waiting_confirm", { selectedIndex: selection - 1 });
    await sendText(
      ctx.phone,
      `"${selected.vendor}" icin hatirlatma gonderilecek.\n\nOnaylamak icin 'evet' yazin:`,
    );
    return;
  }

  if (session.current_step === "waiting_confirm") {
    if (ctx.text.toLowerCase().trim() === "evet") {
      const selectedIndex = (data.selectedIndex as number) ?? 0;
      const selected = invoices[selectedIndex];

      try {
        const supabase = getServiceClient();
        await supabase.from("muh_tahsilat_reminders").insert({
          tenant_id: ctx.tenantId,
          invoice_id: selected?.id || null,
          reminder_type: "whatsapp_manual",
          sent_at: new Date().toISOString(),
          email_sent: false,
        });

        await sendButtons(
          ctx.phone,
          `Hatirlatma kaydi olusturuldu: "${selected?.vendor || "Bilinmeyen"}"`,
          [{ id: "cmd:menu", title: "Ana Menu" }],
        );
      } catch (err) {
        console.error("[muhasebe:hatirlatma_gonder] insert error:", err);
        await sendText(ctx.phone, "Hatirlatma kaydedilirken bir hata olustu.");
      }
    } else {
      await sendText(ctx.phone, "Hatirlatma gonderme iptal edildi.");
    }

    await endSession(ctx.userId);
    return;
  }

  await endSession(ctx.userId);
}

// ── odeme_ekle (multi-step) ───────────────────────────────────────────

export async function handleOdemeEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "odeme_ekle", "waiting_mukellef");
  await sendText(
    ctx.phone,
    "*Odeme Kaydi Ekle*\n\nMukellef/firma adini yazin:",
  );
}

export async function stepOdemeEkle(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;

  if (session.current_step === "waiting_mukellef") {
    await updateSession(ctx.userId, "waiting_amount", { mukellef_name: ctx.text.trim() });
    await sendText(ctx.phone, "Odeme tutarini yazin (ornek: 5000):");
    return;
  }

  if (session.current_step === "waiting_amount") {
    const cleaned = ctx.text.replace(/\./g, "").replace(",", ".").trim();
    const amount = parseFloat(cleaned);

    if (isNaN(amount) || amount <= 0) {
      await sendText(ctx.phone, "Gecerli bir tutar girin (ornek: 5000):");
      return;
    }

    await updateSession(ctx.userId, "waiting_method", { amount });
    await sendText(ctx.phone, "Odeme yontemi (nakit/havale/eft/kredi karti):");
    return;
  }

  if (session.current_step === "waiting_method") {
    const method = ctx.text.trim().toLowerCase() || "nakit";

    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("muh_payments").insert({
        tenant_id: ctx.tenantId,
        mukellef_name: data.mukellef_name as string,
        amount: data.amount as number,
        method,
        payment_date: todayISO(),
      });

      if (error) {
        console.error("[muhasebe:odeme_ekle] insert error:", error);
        await sendText(ctx.phone, "Odeme kaydedilirken bir hata olustu.");
      } else {
        await sendButtons(
          ctx.phone,
          `Odeme kaydedildi:\n\nMukellef: *${data.mukellef_name}*\nTutar: ${formatCurrency(data.amount as number)}\nYontem: ${method}`,
          [
            { id: "cmd:alacaklar", title: "Alacaklar" },
            { id: "cmd:menu", title: "Ana Menu" },
          ],
        );
      }
    } catch (err) {
      console.error("[muhasebe:odeme_ekle] error:", err);
      await sendText(ctx.phone, "Odeme kaydedilirken bir hata olustu.");
    }

    await endSession(ctx.userId);
    return;
  }

  await endSession(ctx.userId);
}

// ── nakit_akis ────────────────────────────────────────────────────────

export async function handleNakitAkis(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Receivables: invoices with due_date in next 30 days
    const { data: receivables } = await supabase
      .from("muh_invoices")
      .select("amount, due_date")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .gte("due_date", today)
      .lte("due_date", thirtyDaysLater);

    // Overdue: invoices past due
    const { data: overdue } = await supabase
      .from("muh_invoices")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today);

    // Recent payments
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const { data: payments } = await supabase
      .from("muh_payments")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", thirtyDaysAgo);

    const totalReceivable = (receivables || []).reduce(
      (sum: number, inv: any) => sum + (Number(inv.amount) || 0),
      0,
    );
    const totalOverdue = (overdue || []).reduce(
      (sum: number, inv: any) => sum + (Number(inv.amount) || 0),
      0,
    );
    const totalPayments = (payments || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0),
      0,
    );

    const report = [
      `*Nakit Akis Tahmini (30 Gun)*`,
      ``,
      `Beklenen alacak: ${formatCurrency(totalReceivable)} (${(receivables || []).length} fatura)`,
      `Geciken alacak: ${formatCurrency(totalOverdue)} (${(overdue || []).length} fatura)`,
      `Son 30 gun tahsilat: ${formatCurrency(totalPayments)} (${(payments || []).length} odeme)`,
      ``,
      `Toplam beklenen: ${formatCurrency(totalReceivable + totalOverdue)}`,
      ``,
      `_Not: Bu rapor fatura vadelerine dayali bir tahmindir._`,
    ].join("\n");

    await sendButtons(ctx.phone, report, [
      { id: "cmd:risk", title: "Risk Analizi" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[muhasebe:nakit_akis] error:", err);
    await sendText(ctx.phone, "Nakit akis raporu olusturulurken bir hata olustu.");
  }
}

// ── risk ──────────────────────────────────────────────────────────────

export async function handleRisk(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();

    const { data: overdueInvoices } = await supabase
      .from("muh_invoices")
      .select("vendor_name, amount, due_date")
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today);

    if (!overdueInvoices?.length) {
      await sendButtons(ctx.phone, "Geciken odeme bulunmuyor, risk degerlendirmesi yapilamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Aggregate by vendor
    const vendorRisk: Record<string, { totalOverdue: number; count: number; maxDays: number }> = {};

    for (const inv of overdueInvoices) {
      const vendor = (inv as any).vendor_name || "Bilinmeyen";
      if (!vendorRisk[vendor]) {
        vendorRisk[vendor] = { totalOverdue: 0, count: 0, maxDays: 0 };
      }
      vendorRisk[vendor].totalOverdue += Number((inv as any).amount) || 0;
      vendorRisk[vendor].count += 1;

      if ((inv as any).due_date) {
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date((inv as any).due_date).getTime()) / (1000 * 60 * 60 * 24),
        );
        vendorRisk[vendor].maxDays = Math.max(vendorRisk[vendor].maxDays, daysOverdue);
      }
    }

    // Sort by total overdue amount (highest risk first)
    const sorted = Object.entries(vendorRisk)
      .sort(([, a], [, b]) => b.totalOverdue - a.totalOverdue)
      .slice(0, 5);

    const lines = sorted.map(([vendor, data], i) => {
      const riskLevel =
        data.maxDays > 90 ? "YUKSEK" : data.maxDays > 30 ? "ORTA" : "DUSUK";
      const icon = data.maxDays > 90 ? "🔴" : data.maxDays > 30 ? "🟡" : "🟢";
      return (
        `${i + 1}. ${icon} ${vendor}\n` +
        `   Geciken: ${formatCurrency(data.totalOverdue)} (${data.count} fatura)\n` +
        `   En uzun gecikme: ${data.maxDays} gun — Risk: ${riskLevel}`
      );
    });

    await sendButtons(
      ctx.phone,
      `*Risk Degerlendirmesi (Top 5)*\n\n${lines.join("\n\n")}`,
      [
        { id: "cmd:geciken", title: "Geciken Odemeler" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:risk] error:", err);
    await sendText(ctx.phone, "Risk analizi olusturulurken bir hata olustu.");
  }
}
