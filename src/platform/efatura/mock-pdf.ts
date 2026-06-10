/**
 * Mock e-Fatura PDF üretimi — pdf-lib (pure JS, Turbopack uyumlu).
 *
 * Audit 2026-06-10 P0 #4: mock fatura pdf_url'i data:text/plain idi —
 * "PDF indir" düz metin indiriyordu. Artık gerçek PDF üretilir ve
 * Supabase Storage'a (bayi-invoices bucket) yüklenir.
 *
 * Not: pdf-lib standart fontları WinAnsi encoding kullanır — Türkçe'ye
 * özgü karakterler (ş, ğ, ı, İ) embed font olmadan render edilemez.
 * Mock fatura için ASCII'ye sadeleştiriyoruz; canlı Foriba kendi
 * GİB-geçerli PDF'ini döndürecek.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueInvoiceArgs } from "./types";

const TR_MAP: Record<string, string> = {
  ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
  ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U",
  "₺": "TL",
};

function ascii(s: string): string {
  return s.replace(/[şŞğĞıİçÇöÖüÜ₺]/g, (ch) => TR_MAP[ch] ?? ch);
}

export async function buildMockInvoicePdf(
  invoiceNo: string,
  args: IssueInvoiceArgs,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const slate = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.4, 0.45, 0.55);
  const indigo = rgb(0.31, 0.27, 0.9);
  const line = rgb(0.89, 0.91, 0.94);

  let y = 790;
  const left = 50;
  const right = 545;

  // Başlık bandı — "logo" + ürün adı
  page.drawRectangle({ x: left, y: y - 6, width: 34, height: 34, color: indigo });
  page.drawText("U", { x: left + 11, y: y + 3, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("UPU B2B Portal", { x: left + 44, y: y + 10, size: 14, font: bold, color: slate });
  page.drawText(ascii("e-Fatura"), { x: left + 44, y: y - 3, size: 9, font, color: muted });
  page.drawText(ascii("MOCK / TEST BELGESİ"), {
    x: right - 130, y: y + 10, size: 9, font: bold, color: rgb(0.86, 0.41, 0.09),
  });
  y -= 40;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 24;

  // Fatura meta
  const meta: Array<[string, string]> = [
    ["Fatura No", invoiceNo],
    ["Tarih", args.issueDate],
    ["Siparis", args.orderNumber],
    ["Para Birimi", args.currency],
  ];
  for (const [k, v] of meta) {
    page.drawText(ascii(`${k}:`), { x: left, y, size: 10, font: bold, color: slate });
    page.drawText(ascii(v), { x: left + 90, y, size: 10, font, color: slate });
    y -= 16;
  }
  y -= 8;

  // Alıcı
  page.drawText(ascii("ALICI"), { x: left, y, size: 9, font: bold, color: muted });
  y -= 15;
  page.drawText(ascii(args.buyer.name), { x: left, y, size: 11, font: bold, color: slate });
  y -= 14;
  if (args.buyer.taxNo) {
    page.drawText(ascii(`VKN: ${args.buyer.taxNo}`), { x: left, y, size: 9, font, color: muted });
    y -= 13;
  }
  if (args.buyer.address) {
    page.drawText(ascii(args.buyer.address).slice(0, 90), { x: left, y, size: 9, font, color: muted });
    y -= 13;
  }
  y -= 12;

  // Kalem tablosu başlığı
  page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 18, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("Kod", { x: left + 6, y, size: 9, font: bold, color: muted });
  page.drawText(ascii("Ürün"), { x: left + 80, y, size: 9, font: bold, color: muted });
  page.drawText("Miktar", { x: 380, y, size: 9, font: bold, color: muted });
  page.drawText("B.Fiyat", { x: 435, y, size: 9, font: bold, color: muted });
  page.drawText("Tutar", { x: 498, y, size: 9, font: bold, color: muted });
  y -= 20;

  for (const l of args.lines.slice(0, 30)) {
    page.drawText(ascii(l.productCode).slice(0, 14), { x: left + 6, y, size: 9, font, color: slate });
    page.drawText(ascii(l.productName).slice(0, 48), { x: left + 80, y, size: 9, font, color: slate });
    page.drawText(String(l.quantity), { x: 380, y, size: 9, font, color: slate });
    page.drawText(l.unitPrice.toFixed(2), { x: 435, y, size: 9, font, color: slate });
    page.drawText(l.lineTotal.toFixed(2), { x: 498, y, size: 9, font, color: slate });
    y -= 15;
    if (y < 160) break; // tek sayfa mock — taşanı kes
  }
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 20;

  // Toplamlar
  const totals: Array<[string, string, boolean]> = [
    ["Ara toplam", `${args.subtotal.toFixed(2)} ${args.currency}`, false],
    ["Indirim", `-${args.discountTotal.toFixed(2)} ${args.currency}`, false],
    ["KDV", `${args.taxTotal.toFixed(2)} ${args.currency}`, false],
    ["TOPLAM", `${args.total.toFixed(2)} ${args.currency}`, true],
  ];
  for (const [k, v, strong] of totals) {
    const f = strong ? bold : font;
    page.drawText(ascii(k), { x: 380, y, size: strong ? 11 : 10, font: f, color: slate });
    page.drawText(ascii(v), { x: 470, y, size: strong ? 11 : 10, font: f, color: strong ? indigo : slate });
    y -= strong ? 20 : 16;
  }

  // Alt not
  page.drawText(
    ascii("Bu belge test (mock) faturasidir — GİB-geçerli e-Fatura, Foriba canlı bağlantısı aktive edildiğinde kesilecektir."),
    { x: left, y: 70, size: 8, font, color: muted },
  );

  return doc.save();
}

/**
 * PDF'i bayi-invoices bucket'ına yükler, public URL döner.
 * Upload başarısızsa data:application/pdf fallback (yine gerçek PDF).
 */
export async function uploadMockInvoicePdf(
  sb: SupabaseClient,
  tenantId: string,
  invoiceNo: string,
  pdfBytes: Uint8Array,
): Promise<string> {
  const path = `${tenantId}/${invoiceNo}.pdf`;
  const { error } = await sb.storage
    .from("bayi-invoices")
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (!error) {
    const { data } = sb.storage.from("bayi-invoices").getPublicUrl(path);
    if (data?.publicUrl) return data.publicUrl;
  } else {
    console.error("[efatura:mock-pdf:upload]", error.message);
  }
  const b64 = Buffer.from(pdfBytes).toString("base64");
  return `data:application/pdf;base64,${b64}`;
}
