/**
 * Fatura Isleme Uzmani commands:
 * /fatura_yukle — Fatura yukleme (web panel yonlendirme)
 * /son_faturalar — Son eklenen faturalar
 * /fatura_ara — Vendor adina gore arama (multi-step)
 * /fatura_detay — Fatura detayi (multi-step)
 * /fatura_rapor — Aylik fatura ozeti
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, endSession } from "@/platform/whatsapp/session";
import { formatCurrency, formatDate, monthStart, currentMonth, webPanelRedirect } from "./helpers";

// ── fatura_yukle ──────────────────────────────────────────────────────

export async function handleFaturaYukle(ctx: WaContext): Promise<void> {
  await webPanelRedirect(
    ctx.phone,
    "Fatura yukleme islemi su an web panelinden yapilabilir.\n\ne-Fatura (HTML), PDF veya fatura fotografi yukleyebilirsiniz.",
  );
}

// ── son_faturalar ─────────────────────────────────────────────────────

export async function handleSonFaturalar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: invoices, error } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, invoice_date, invoice_no")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[muhasebe:son_faturalar] error:", error);
      await sendText(ctx.phone, "Faturalar yuklenirken bir hata olustu.");
      return;
    }

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Henuz kayitli fatura bulunmuyor.", [
        { id: "cmd:fatura_yukle", title: "Fatura Yukle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = invoices.map((inv: any, i: number) => {
      const vendor = inv.vendor_name || "Bilinmeyen";
      const amount = inv.amount != null ? formatCurrency(Number(inv.amount)) : "-";
      const date = inv.invoice_date ? formatDate(inv.invoice_date) : "-";
      return `${i + 1}. ${vendor} — ${amount} (${date})`;
    });

    await sendButtons(
      ctx.phone,
      `*Son ${invoices.length} Fatura*\n\n${lines.join("\n")}`,
      [
        { id: "cmd:fatura_ara", title: "Fatura Ara" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:son_faturalar] error:", err);
    await sendText(ctx.phone, "Faturalar yuklenirken bir hata olustu.");
  }
}

// ── fatura_ara (multi-step) ───────────────────────────────────────────

export async function handleFaturaAra(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fatura_ara", "waiting_vendor");
  await sendText(ctx.phone, "Aramak istediginiz firma/tedarikci adini yazin:");
}

export async function stepFaturaAra(ctx: WaContext, session: CommandSession): Promise<void> {
  try {
    const supabase = getServiceClient();
    const searchTerm = ctx.text.trim();

    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("id, vendor_name, amount, invoice_date, invoice_no")
      .eq("tenant_id", ctx.tenantId)
      .ilike("vendor_name", `%${searchTerm}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!invoices?.length) {
      await sendText(ctx.phone, `"${searchTerm}" icin fatura bulunamadi.`);
    } else {
      const lines = invoices.map((inv: any, i: number) => {
        const amount = inv.amount != null ? formatCurrency(Number(inv.amount)) : "-";
        return `${i + 1}. ${inv.vendor_name || "-"} — ${amount} (${inv.invoice_date ? formatDate(inv.invoice_date) : "-"})`;
      });
      await sendButtons(
        ctx.phone,
        `"${searchTerm}" icin ${invoices.length} fatura:\n\n${lines.join("\n")}`,
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
    }
  } catch (err) {
    console.error("[muhasebe:fatura_ara] error:", err);
    await sendText(ctx.phone, "Arama sirasinda bir hata olustu.");
  }
  await endSession(ctx.userId);
}

// ── fatura_detay (multi-step) ─────────────────────────────────────────

export async function handleFaturaDetay(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fatura_detay", "waiting_identifier");
  await sendText(ctx.phone, "Fatura numarasi veya firma adi yazin:");
}

export async function stepFaturaDetay(ctx: WaContext, session: CommandSession): Promise<void> {
  try {
    const supabase = getServiceClient();
    const searchTerm = ctx.text.trim();

    // Search by invoice_no first, then vendor_name
    let { data: invoice } = await supabase
      .from("muh_invoices")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .ilike("invoice_no", `%${searchTerm}%`)
      .limit(1)
      .maybeSingle();

    if (!invoice) {
      const result = await supabase
        .from("muh_invoices")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .ilike("vendor_name", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoice = result.data;
    }

    if (!invoice) {
      await sendText(ctx.phone, `"${searchTerm}" ile eslesen fatura bulunamadi.`);
    } else {
      const amount = invoice.amount != null ? formatCurrency(Number(invoice.amount)) : "-";
      const detail = [
        `*Fatura Detayi*`,
        ``,
        `Firma: ${invoice.vendor_name || "-"}`,
        `Fatura No: ${invoice.invoice_no || "-"}`,
        `Tarih: ${invoice.invoice_date ? formatDate(invoice.invoice_date) : "-"}`,
        `Tutar: ${amount}`,
        `VKN: ${invoice.vkn || "-"}`,
        `Alici: ${invoice.receiver_name || "-"}`,
        `Vade: ${invoice.due_date ? formatDate(invoice.due_date) : "-"}`,
      ].join("\n");

      await sendButtons(ctx.phone, detail, [{ id: "cmd:menu", title: "Ana Menu" }]);
    }
  } catch (err) {
    console.error("[muhasebe:fatura_detay] error:", err);
    await sendText(ctx.phone, "Fatura detayi yuklenirken bir hata olustu.");
  }
  await endSession(ctx.userId);
}

// ── fatura_rapor ──────────────────────────────────────────────────────

export async function handleFaturaRapor(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("amount, vendor_name, invoice_date")
      .eq("tenant_id", ctx.tenantId)
      .gte("invoice_date", monthStart())
      .order("amount", { ascending: false });

    if (!invoices?.length) {
      await sendButtons(ctx.phone, "Bu ay icin kayitli fatura bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const total = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);
    const topVendors = invoices.slice(0, 5).map((inv: any, i: number) => {
      return `${i + 1}. ${inv.vendor_name || "-"} — ${formatCurrency(Number(inv.amount) || 0)}`;
    });

    const report = [
      `*Aylik Fatura Raporu*`,
      `${currentMonth()}`,
      ``,
      `Toplam fatura: ${invoices.length}`,
      `Toplam tutar: ${formatCurrency(total)}`,
      ``,
      `En yuksek 5 fatura:`,
      ...topVendors,
    ].join("\n");

    await sendButtons(ctx.phone, report, [{ id: "cmd:menu", title: "Ana Menu" }]);
  } catch (err) {
    console.error("[muhasebe:fatura_rapor] error:", err);
    await sendText(ctx.phone, "Fatura raporu olusturulurken bir hata olustu.");
  }
}
