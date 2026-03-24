/**
 * Vergi Uzmani commands:
 * /kdv — KDV hesaplama (multi-step)
 * /gelir_vergisi — Gelir vergisi hesaplama (multi-step)
 * /kurumlar — Kurumlar vergisi hesaplama (multi-step)
 * /vergi_raporu — Vergi raporu
 * /kontrol — Beyanname tutarsizlik tespiti
 * /oranlar — Guncel vergi oranlari
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, endSession } from "@/platform/whatsapp/session";
import { formatCurrency, currentMonth } from "./helpers";

// ── Shared helpers ────────────────────────────────────────────────────

function parseTurkishNumber(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(cleaned);
}

function fmtPct(n: number): string {
  return `%${(n * 100).toFixed(0)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── kdv (multi-step) ─────────────────────────────────────────────────

export async function handleKdv(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "kdv", "waiting_amount");
  await sendText(ctx.phone, "*KDV Hesaplama*\n\nTutari yazin (ornek: 1000 veya 1.500,50):");
}

export async function stepKdv(ctx: WaContext, session: CommandSession): Promise<void> {
  const amount = parseTurkishNumber(ctx.text);

  if (isNaN(amount) || amount <= 0) {
    await sendText(ctx.phone, "Gecerli bir tutar girin (ornek: 1000 veya 1.500,50):");
    return;
  }

  const kdvRate = 0.20;
  const kdvAmount = amount * kdvRate;
  const totalWithKdv = amount + kdvAmount;
  const netFromGross = amount / (1 + kdvRate);
  const kdvInGross = amount - netFromGross;

  const result = [
    `*KDV Hesaplama (${fmtPct(kdvRate)})*`,
    ``,
    `*KDV Haric (Net):*`,
    `  Tutar: ${fmtNum(amount)} TL`,
    `  KDV:   ${fmtNum(kdvAmount)} TL`,
    `  Toplam: ${fmtNum(totalWithKdv)} TL`,
    ``,
    `*KDV Dahil (Brut):*`,
    `  Brut:  ${fmtNum(amount)} TL`,
    `  Net:   ${fmtNum(netFromGross)} TL`,
    `  KDV:   ${fmtNum(kdvInGross)} TL`,
  ].join("\n");

  await sendButtons(ctx.phone, result, [
    { id: "cmd:oranlar", title: "Vergi Oranlari" },
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
  await endSession(ctx.userId);
}

// ── gelir_vergisi (multi-step) ────────────────────────────────────────

export async function handleGelirVergisi(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "gelir_vergisi", "waiting_amount");
  await sendText(
    ctx.phone,
    "*Gelir Vergisi Hesaplama*\n\nYillik matrah tutarini yazin (ornek: 500000):",
  );
}

export async function stepGelirVergisi(ctx: WaContext, session: CommandSession): Promise<void> {
  const matrah = parseTurkishNumber(ctx.text);

  if (isNaN(matrah) || matrah <= 0) {
    await sendText(ctx.phone, "Gecerli bir tutar girin (ornek: 500000):");
    return;
  }

  // 2026 TR gelir vergisi dilimleri
  const brackets = [
    { limit: 110_000, rate: 0.15 },
    { limit: 230_000, rate: 0.20 },
    { limit: 870_000, rate: 0.27 },
    { limit: 3_000_000, rate: 0.35 },
    { limit: Infinity, rate: 0.40 },
  ];

  let remaining = matrah;
  let totalTax = 0;
  let prevLimit = 0;
  const details: string[] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bracketSize = bracket.limit - prevLimit;
    const taxable = Math.min(remaining, bracketSize);
    const tax = taxable * bracket.rate;
    totalTax += tax;
    details.push(`  ${fmtNum(taxable)} TL x ${fmtPct(bracket.rate)} = ${fmtNum(tax)} TL`);
    remaining -= taxable;
    prevLimit = bracket.limit;
  }

  const effectiveRate = totalTax / matrah;

  const result = [
    `*Gelir Vergisi Hesaplama*`,
    ``,
    `Matrah: ${fmtNum(matrah)} TL`,
    ``,
    `*Dilim detayi:*`,
    ...details,
    ``,
    `*Toplam vergi:* ${fmtNum(totalTax)} TL`,
    `*Efektif oran:* ${fmtPct(effectiveRate)}`,
  ].join("\n");

  await sendButtons(ctx.phone, result, [
    { id: "cmd:oranlar", title: "Vergi Oranlari" },
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
  await endSession(ctx.userId);
}

// ── kurumlar (multi-step) ─────────────────────────────────────────────

export async function handleKurumlar(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "kurumlar", "waiting_amount");
  await sendText(
    ctx.phone,
    "*Kurumlar Vergisi Hesaplama*\n\nKurum kazanci (matrah) tutarini yazin:",
  );
}

export async function stepKurumlar(ctx: WaContext, session: CommandSession): Promise<void> {
  const matrah = parseTurkishNumber(ctx.text);

  if (isNaN(matrah) || matrah <= 0) {
    await sendText(ctx.phone, "Gecerli bir tutar girin:");
    return;
  }

  const rate = 0.25;
  const tax = matrah * rate;
  const net = matrah - tax;

  const result = [
    `*Kurumlar Vergisi Hesaplama*`,
    ``,
    `Matrah: ${fmtNum(matrah)} TL`,
    `Oran: ${fmtPct(rate)}`,
    `Vergi: ${fmtNum(tax)} TL`,
    `Net kazanc: ${fmtNum(net)} TL`,
  ].join("\n");

  await sendButtons(ctx.phone, result, [{ id: "cmd:menu", title: "Ana Menu" }]);
  await endSession(ctx.userId);
}

// ── vergi_raporu ──────────────────────────────────────────────────────

export async function handleVergiRaporu(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const now = new Date();
    const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { data: invoices } = await supabase
      .from("muh_invoices")
      .select("amount, vendor_name")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", monthStartDate)
      .lte("created_at", monthEndDate);

    const totalAmount = (invoices || []).reduce(
      (sum: number, inv: any) => sum + (Number(inv.amount) || 0),
      0,
    );
    const invoiceCount = invoices?.length ?? 0;

    const { count: pendingFilings } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi");

    const estimatedKdv = totalAmount * 0.20;

    const report = [
      `*Vergi Raporu — ${currentMonth()}*`,
      ``,
      `Fatura sayisi: ${invoiceCount}`,
      `Toplam tutar: ${fmtNum(totalAmount)} TL`,
      `Tahmini KDV (%20): ${fmtNum(estimatedKdv)} TL`,
      ``,
      `Bekleyen beyanname: ${pendingFilings ?? 0}`,
      ``,
      `_Not: Bu rapor tahmini degerleri gosterir._`,
    ].join("\n");

    await sendButtons(ctx.phone, report, [
      { id: "cmd:kontrol", title: "Beyanname Kontrol" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[muhasebe:vergi_raporu] error:", err);
    await sendText(ctx.phone, "Vergi raporu olusturulurken bir hata olustu.");
  }
}

// ── kontrol ───────────────────────────────────────────────────────────

export async function handleKontrol(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: incomplete, error } = await supabase
      .from("muh_beyanname_statuses")
      .select("beyanname_type, period, status, deadline_date")
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi")
      .order("deadline_date", { ascending: true });

    if (error) {
      console.error("[muhasebe:kontrol] error:", error);
      await sendText(ctx.phone, "Kontrol sirasinda bir hata olustu.");
      return;
    }

    if (!incomplete?.length) {
      await sendButtons(ctx.phone, "Tum beyannameler tamamlanmis durumda.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = incomplete.map((s: any, i: number) => {
      const type = s.beyanname_type || "Bilinmeyen";
      const period = s.period || "-";
      const status = s.status || "-";
      return `${i + 1}. ${type} (${period}) — ${status}`;
    });

    await sendButtons(
      ctx.phone,
      `*Tamamlanmamis Beyannameler* (${incomplete.length})\n\n${lines.join("\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[muhasebe:kontrol] error:", err);
    await sendText(ctx.phone, "Kontrol sirasinda bir hata olustu.");
  }
}

// ── oranlar ───────────────────────────────────────────────────────────

export async function handleOranlar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: rates, error } = await supabase
      .from("muh_tax_rates")
      .select("category, name, rate, description")
      .or(`tenant_id.eq.${ctx.tenantId},tenant_id.is.null`)
      .order("category", { ascending: true });

    if (error) {
      console.error("[muhasebe:oranlar] error:", error);
      await sendText(ctx.phone, "Vergi oranlari yuklenirken bir hata olustu.");
      return;
    }

    if (!rates?.length) {
      await sendButtons(ctx.phone, "Kayitli vergi orani bulunmuyor.\n\nVarsayilan KDV orani: %20", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Group by category
    const grouped: Record<string, Array<{ name: string; rate: number; desc: string }>> = {};
    for (const r of rates) {
      const cat = (r as any).category || "Genel";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        name: (r as any).name || "-",
        rate: Number((r as any).rate) || 0,
        desc: (r as any).description || "",
      });
    }

    const sections = Object.entries(grouped).map(([cat, items]) => {
      const itemLines = items.map(
        (it) => `  ${it.name}: %${it.rate}${it.desc ? ` (${it.desc})` : ""}`,
      );
      return `*${cat}:*\n${itemLines.join("\n")}`;
    });

    await sendButtons(
      ctx.phone,
      `*Vergi Oranlari*\n\n${sections.join("\n\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[muhasebe:oranlar] error:", err);
    await sendText(ctx.phone, "Vergi oranlari yuklenirken bir hata olustu.");
  }
}
