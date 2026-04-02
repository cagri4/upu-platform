/**
 * Additional Muhasebe commands:
 * /gider_ekle — Gider kaydi ekle (multi-step)
 * /donem_ozeti — Aylik/ceyreklik donem ozeti
 * /banka_mutabakat — Banka mutabakat durumu
 * /mukellef_detay — Mukellef detayi (multi-step)
 * /randevu_ekle — Randevu olustur (multi-step)
 * /fatura_ekle — Hizli fatura kaydi (multi-step)
 * /webpanel — Web panel yonlendirme
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { formatCurrency, formatDate, todayISO, monthStart, currentMonth, webPanelRedirect } from "./helpers";

// ── gider_ekle (multi-step) ────────────────────────────────────────────

export async function handleGiderEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "gider_ekle", "waiting_description");
  await sendText(
    ctx.phone,
    "*Gider Kaydi Ekle*\n\nGider aciklamasini yazin (ornek: Kira, Elektrik, Ofis malzemesi):",
  );
}

export async function stepGiderEkle(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;

  if (session.current_step === "waiting_description") {
    await updateSession(ctx.userId, "waiting_amount", { description: ctx.text.trim() });
    await sendText(ctx.phone, "Gider tutarini yazin (ornek: 2500):");
    return;
  }

  if (session.current_step === "waiting_amount") {
    const cleaned = ctx.text.replace(/\./g, "").replace(",", ".").trim();
    const amount = parseFloat(cleaned);

    if (isNaN(amount) || amount <= 0) {
      await sendText(ctx.phone, "Gecerli bir tutar girin (ornek: 2500):");
      return;
    }

    await updateSession(ctx.userId, "waiting_category", { amount });
    await sendText(ctx.phone, "Gider kategorisi (kira/personel/ofis/vergi/diger):");
    return;
  }

  if (session.current_step === "waiting_category") {
    const category = ctx.text.trim().toLowerCase() || "diger";

    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("muh_expenses").insert({
        tenant_id: ctx.tenantId,
        description: data.description as string,
        amount: data.amount as number,
        category,
        expense_date: todayISO(),
      });

      if (error) {
        console.error("[muhasebe:gider_ekle] insert error:", error);
        await sendText(ctx.phone, "Gider kaydedilirken bir hata olustu.");
      } else {
        await sendButtons(
          ctx.phone,
          `Gider kaydedildi:\n\nAciklama: *${data.description}*\nTutar: ${formatCurrency(data.amount as number)}\nKategori: ${category}`,
          [
            { id: "cmd:donem_ozeti", title: "Donem Ozeti" },
            { id: "cmd:menu", title: "Ana Menu" },
          ],
        );
      }
    } catch (err) {
      console.error("[muhasebe:gider_ekle] error:", err);
      await sendText(ctx.phone, "Gider kaydedilirken bir hata olustu.");
    }

    await endSession(ctx.userId);
    return;
  }

  await endSession(ctx.userId);
}

// ── donem_ozeti ──────────────────────────────────────────────────────────

export async function handleDonemOzeti(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const mStart = monthStart();

    // Invoices this month
    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("invoice_date", mStart);

    const invoiceTotal = (invoices || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.amount) || 0), 0,
    );

    // Expenses this month
    const { data: expenses } = await supabase
      .from("muh_expenses")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("expense_date", mStart);

    const expenseTotal = (expenses || []).reduce(
      (sum: number, exp: Record<string, unknown>) => sum + (Number(exp.amount) || 0), 0,
    );

    // Payments this month
    const { data: payments } = await supabase
      .from("muh_payments")
      .select("amount")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", mStart);

    const paymentTotal = (payments || []).reduce(
      (sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0,
    );

    // Pending filings
    const { count: pendingCount } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi");

    const report = [
      `*Donem Ozeti — ${currentMonth()}*`,
      ``,
      `Fatura sayisi: ${invoices?.length ?? 0}`,
      `Fatura toplami: ${formatCurrency(invoiceTotal)}`,
      ``,
      `Gider sayisi: ${expenses?.length ?? 0}`,
      `Gider toplami: ${formatCurrency(expenseTotal)}`,
      ``,
      `Tahsilat: ${formatCurrency(paymentTotal)} (${payments?.length ?? 0} odeme)`,
      ``,
      `Bekleyen beyanname: ${pendingCount ?? 0}`,
      ``,
      `Net durum: ${formatCurrency(paymentTotal - expenseTotal)}`,
    ].join("\n");

    await sendButtons(ctx.phone, report, [
      { id: "cmd:nakit_akis", title: "Nakit Akis" },
      { id: "cmd:vergi_raporu", title: "Vergi Raporu" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[muhasebe:donem_ozeti] error:", err);
    await sendText(ctx.phone, "Donem ozeti olusturulurken bir hata olustu.");
  }
}

// ── banka_mutabakat ─────────────────────────────────────────────────────

export async function handleBankaMutabakat(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const mStart = monthStart();

    // Get invoices and payments for reconciliation
    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("amount, vendor_name")
      .eq("tenant_id", ctx.tenantId)
      .gte("invoice_date", mStart);

    const { data: payments } = await supabase
      .from("muh_payments")
      .select("amount, mukellef_name, method")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", mStart);

    const invoiceTotal = (invoices || []).reduce(
      (sum: number, inv: Record<string, unknown>) => sum + (Number(inv.amount) || 0), 0,
    );
    const paymentTotal = (payments || []).reduce(
      (sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0,
    );

    // Payment method breakdown
    const methodTotals: Record<string, number> = {};
    for (const p of (payments || [])) {
      const method = (p as Record<string, unknown>).method as string || "diger";
      methodTotals[method] = (methodTotals[method] || 0) + (Number((p as Record<string, unknown>).amount) || 0);
    }

    const methodLines = Object.entries(methodTotals).map(
      ([method, total]) => `  ${method}: ${formatCurrency(total)}`,
    );

    const diff = paymentTotal - invoiceTotal;
    const report = [
      `*Banka Mutabakat — ${currentMonth()}*`,
      ``,
      `Faturalar toplami: ${formatCurrency(invoiceTotal)} (${invoices?.length ?? 0} adet)`,
      `Odemeler toplami: ${formatCurrency(paymentTotal)} (${payments?.length ?? 0} adet)`,
      ``,
      `Fark: ${formatCurrency(diff)}`,
      ``,
      `*Odeme yontemleri:*`,
      ...(methodLines.length ? methodLines : ["  Kayit yok"]),
      ``,
      `_Not: Bu rapor sistem verilerine dayali tahminidir._`,
    ].join("\n");

    await sendButtons(ctx.phone, report, [
      { id: "cmd:donem_ozeti", title: "Donem Ozeti" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[muhasebe:banka_mutabakat] error:", err);
    await sendText(ctx.phone, "Banka mutabakat raporu olusturulurken bir hata olustu.");
  }
}

// ── mukellef_detay (multi-step) ─────────────────────────────────────────

export async function handleMukellefDetay(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mukellef_detay", "waiting_name");
  await sendText(ctx.phone, "Mukellef adini veya VKN numarasini yazin:");
}

export async function stepMukellefDetay(ctx: WaContext, session: CommandSession): Promise<void> {
  try {
    const supabase = getServiceClient();
    const searchTerm = ctx.text.trim();

    // Search by name or VKN
    let { data: mukellef } = await supabase
      .from("muh_mukellefler")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .ilike("name", `%${searchTerm}%`)
      .limit(1)
      .maybeSingle();

    if (!mukellef) {
      const result = await supabase
        .from("muh_mukellefler")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .ilike("vkn", `%${searchTerm}%`)
        .limit(1)
        .maybeSingle();
      mukellef = result.data;
    }

    if (!mukellef) {
      await sendText(ctx.phone, `"${searchTerm}" ile eslesen mukellef bulunamadi.`);
    } else {
      // Get invoices for this mukellef
      const { count: invoiceCount } = await supabase
        .from("muh_invoices")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId)
        .ilike("vendor_name", `%${(mukellef as Record<string, unknown>).name}%`);

      const detail = [
        `*Mukellef Detayi*`,
        ``,
        `Ad/Unvan: ${(mukellef as Record<string, unknown>).name || "-"}`,
        `VKN: ${(mukellef as Record<string, unknown>).vkn || "-"}`,
        `Telefon: ${(mukellef as Record<string, unknown>).phone || "-"}`,
        `Durum: ${(mukellef as Record<string, unknown>).is_active ? "Aktif" : "Pasif"}`,
        `Fatura sayisi: ${invoiceCount ?? 0}`,
      ].join("\n");

      await sendButtons(ctx.phone, detail, [
        { id: "cmd:mukellefler", title: "Mukellef Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
    }
  } catch (err) {
    console.error("[muhasebe:mukellef_detay] error:", err);
    await sendText(ctx.phone, "Mukellef detayi yuklenirken bir hata olustu.");
  }
  await endSession(ctx.userId);
}

// ── randevu_ekle (multi-step) ───────────────────────────────────────────

export async function handleRandevuEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "randevu_ekle", "waiting_date");
  await sendText(
    ctx.phone,
    "*Yeni Randevu Olustur*\n\nRandevu tarihini yazin (GG.AA.YYYY veya YYYY-MM-DD):",
  );
}

export async function stepRandevuEkle(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;

  if (session.current_step === "waiting_date") {
    let dateStr = ctx.text.trim();
    // Parse DD.MM.YYYY format
    const ddMmYyyy = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ddMmYyyy) {
      dateStr = `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}`;
    }

    // Validate date
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      await sendText(ctx.phone, "Gecerli bir tarih girin (ornek: 15.04.2026 veya 2026-04-15):");
      return;
    }

    await updateSession(ctx.userId, "waiting_time", { date: dateStr });
    await sendText(ctx.phone, "Randevu saatini yazin (ornek: 14:00):");
    return;
  }

  if (session.current_step === "waiting_time") {
    const time = ctx.text.trim();
    await updateSession(ctx.userId, "waiting_subject", { time });
    await sendText(ctx.phone, "Randevu konusunu yazin:");
    return;
  }

  if (session.current_step === "waiting_subject") {
    const subject = ctx.text.trim();

    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("muh_appointments").insert({
        tenant_id: ctx.tenantId,
        date: data.date as string,
        time: data.time as string,
        subject,
      });

      if (error) {
        console.error("[muhasebe:randevu_ekle] insert error:", error);
        await sendText(ctx.phone, "Randevu olusturulurken bir hata olustu.");
      } else {
        await sendButtons(
          ctx.phone,
          `Randevu olusturuldu:\n\nTarih: *${formatDate(data.date as string)}*\nSaat: ${data.time}\nKonu: ${subject}`,
          [
            { id: "cmd:randevular", title: "Randevular" },
            { id: "cmd:menu", title: "Ana Menu" },
          ],
        );
      }
    } catch (err) {
      console.error("[muhasebe:randevu_ekle] error:", err);
      await sendText(ctx.phone, "Randevu olusturulurken bir hata olustu.");
    }

    await endSession(ctx.userId);
    return;
  }

  await endSession(ctx.userId);
}

// ── fatura_ekle (multi-step) ────────────────────────────────────────────

export async function handleFaturaEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fatura_ekle", "waiting_vendor");
  await sendText(
    ctx.phone,
    "*Hizli Fatura Kaydi*\n\nFirma/tedarikci adini yazin:",
  );
}

export async function stepFaturaEkle(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;

  if (session.current_step === "waiting_vendor") {
    await updateSession(ctx.userId, "waiting_invoice_amount", { vendor_name: ctx.text.trim() });
    await sendText(ctx.phone, "Fatura tutarini yazin (ornek: 5000):");
    return;
  }

  if (session.current_step === "waiting_invoice_amount") {
    const cleaned = ctx.text.replace(/\./g, "").replace(",", ".").trim();
    const amount = parseFloat(cleaned);

    if (isNaN(amount) || amount <= 0) {
      await sendText(ctx.phone, "Gecerli bir tutar girin (ornek: 5000):");
      return;
    }

    await updateSession(ctx.userId, "waiting_invoice_no", { amount });
    await sendText(ctx.phone, "Fatura numarasini yazin (bos birakmak icin '-' yazin):");
    return;
  }

  if (session.current_step === "waiting_invoice_no") {
    const invoiceNo = ctx.text.trim() === "-" ? null : ctx.text.trim();

    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("muh_invoices").insert({
        tenant_id: ctx.tenantId,
        vendor_name: data.vendor_name as string,
        amount: data.amount as number,
        invoice_no: invoiceNo,
        invoice_date: todayISO(),
      });

      if (error) {
        console.error("[muhasebe:fatura_ekle] insert error:", error);
        await sendText(ctx.phone, "Fatura kaydedilirken bir hata olustu.");
      } else {
        await sendButtons(
          ctx.phone,
          `Fatura kaydedildi:\n\nFirma: *${data.vendor_name}*\nTutar: ${formatCurrency(data.amount as number)}${invoiceNo ? `\nFatura No: ${invoiceNo}` : ""}`,
          [
            { id: "cmd:son_faturalar", title: "Son Faturalar" },
            { id: "cmd:menu", title: "Ana Menu" },
          ],
        );
      }
    } catch (err) {
      console.error("[muhasebe:fatura_ekle] error:", err);
      await sendText(ctx.phone, "Fatura kaydedilirken bir hata olustu.");
    }

    await endSession(ctx.userId);
    return;
  }

  await endSession(ctx.userId);
}

// ── webpanel ────────────────────────────────────────────────────────────

export async function handleMuhWebpanel(ctx: WaContext): Promise<void> {
  await webPanelRedirect(
    ctx.phone,
    "Web panelden tum islemlerinizi yapabilirsiniz:\n- Fatura yukleme/duzenleme\n- Mukellef yonetimi\n- Beyanname takvimi\n- Raporlar",
  );
}
