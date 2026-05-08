/**
 * /api/sozlesmelerim/pdf?id=<contract_id>&t=<token>  (panel sahibi için)
 * /api/sozlesmelerim/pdf?id=<contract_id>&sign=<sign_token>  (müşteri için, /sign sayfasında)
 *
 * Server-side PDF üretim — pdf-lib + Geist-Regular.ttf (Türkçe karakter
 * destekli, ç ş ğ ı ö ü). Sözleşme metni + (varsa) imza görseli +
 * metadata embed edilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

const PAGE_W = 595; // A4 width in pt
const PAGE_H = 842; // A4 height in pt
const MARGIN_X = 50;
const MARGIN_Y = 50;

interface ContractData {
  property_title?: string;
  property_address?: string;
  property_type?: string;
  listing_type?: string;
  owner_name?: string;
  owner_phone?: string;
  exclusive?: boolean;
  commission?: number;
  duration?: number;
  generated_text?: string;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  const signToken = req.nextUrl.searchParams.get("sign");

  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  if (!token && !signToken) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

  const sb = getServiceClient();

  type ContractRow = {
    id: string;
    contract_data: ContractData;
    signed_at: string | null;
    created_at: string;
    owner_signature_url: string | null;
    user_id: string;
    status: string;
  };
  let contractRow: ContractRow | null = null;

  if (token) {
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token).maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }
    const { data } = await sb
      .from("contracts")
      .select("id, contract_data, signed_at, created_at, owner_signature_url, user_id, status")
      .eq("id", id)
      .eq("user_id", pt.user_id)
      .maybeSingle();
    contractRow = (data as unknown as ContractRow | null) ?? null;
  } else if (signToken) {
    // Sign token bazlı erişim — müşteri /sign sayfasından PDF indirme
    const { data } = await sb
      .from("contracts")
      .select("id, contract_data, signed_at, created_at, owner_signature_url, user_id, status")
      .eq("id", id)
      .eq("sign_token", signToken)
      .maybeSingle();
    contractRow = (data as unknown as ContractRow | null) ?? null;
  }

  if (!contractRow) return NextResponse.json({ error: "Sözleşme bulunamadı." }, { status: 404 });

  const cd = contractRow.contract_data || {};
  const generatedText = cd.generated_text || buildFallbackText(cd);

  // ── PDF oluştur ──────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Geist TTF — Türkçe karakter desteği için (Helvetica vs. Latin-1 limitli)
  const fontPath = join(process.cwd(), "public", "fonts", "Geist-Regular.ttf");
  const fontBytes = await readFile(fontPath);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  pdfDoc.setTitle(`Sozlesme-${contractRow.id.slice(0, 8)}`);
  pdfDoc.setAuthor("UPU Emlak");
  pdfDoc.setSubject(cd.property_title || "Sözleşme");

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_Y;
  const lineHeight = 13;
  const maxWidth = PAGE_W - MARGIN_X * 2;
  const black = rgb(0, 0, 0);
  const grey = rgb(0.4, 0.4, 0.4);

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_Y;
  }

  function drawLine(text: string, opts: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean } = {}) {
    const size = opts.size ?? 10;
    const color = opts.color ?? black;
    if (y - lineHeight < MARGIN_Y) newPage();
    page.drawText(text, { x: MARGIN_X, y, size, font, color, maxWidth });
    y -= (size + 3);
  }

  function drawWrapped(text: string, size = 10, color = black) {
    // Kelime bazlı wrap
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxWidth && line) {
        drawLine(line, { size, color });
        line = word;
      } else {
        line = test;
      }
    }
    if (line) drawLine(line, { size, color });
  }

  function blank(amount = 6) {
    y -= amount;
    if (y < MARGIN_Y) newPage();
  }

  // ── Render generated_text (markdown-ish) ────────────────────────────
  const lines = generatedText.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") { blank(6); continue; }
    if (line === "---") { blank(8); continue; }
    if (line.startsWith("## ")) {
      blank(4);
      const title = line.replace(/^##\s+/, "").replace(/\*\*/g, "");
      drawLine(title, { size: 13 });
      blank(2);
      continue;
    }
    if (line.startsWith("### ")) {
      blank(2);
      const title = line.replace(/^###\s+/, "").replace(/\*\*/g, "");
      drawLine(title, { size: 11 });
      continue;
    }
    // Strip basic markdown (**bold** *italic*) — pdf-lib font subset olduğu için
    // ekstra weight göstermeyi atlıyoruz. Düz okunaklı metin yeterli.
    const clean = line.replace(/\*\*/g, "").replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1");
    drawWrapped(clean, 10, line.startsWith("*") || line.startsWith("_") ? grey : black);
  }

  // ── İmza alanı ──────────────────────────────────────────────────────
  blank(20);
  if (contractRow.signed_at) {
    drawLine(`İmza tarihi: ${new Date(contractRow.signed_at).toLocaleString("tr-TR")}`, { size: 10, color: grey });
    blank(6);

    if (contractRow.owner_signature_url) {
      try {
        const sigRes = await fetch(contractRow.owner_signature_url);
        if (sigRes.ok) {
          const sigBuf = Buffer.from(await sigRes.arrayBuffer());
          const sigImg = await pdfDoc.embedPng(sigBuf);
          const sigW = 200;
          const sigH = (sigImg.height / sigImg.width) * sigW;
          if (y - sigH < MARGIN_Y) newPage();
          y -= sigH;
          page.drawImage(sigImg, { x: MARGIN_X, y, width: sigW, height: sigH });
          blank(8);
          drawLine(`${cd.owner_name || "Mülk Sahibi"} (imzalı)`, { size: 9, color: grey });
        }
      } catch (err) {
        console.error("[sozlesmelerim:pdf] signature fetch fail:", err);
      }
    }
  } else {
    drawLine("Bu sözleşme henüz imzalanmamış.", { size: 10, color: grey });
  }

  blank(20);
  drawLine(`Sözleşme ID: ${contractRow.id}`, { size: 8, color: grey });
  drawLine(`Oluşturulma: ${new Date(contractRow.created_at).toLocaleString("tr-TR")}`, { size: 8, color: grey });
  drawLine(`UPU Emlak — estateai.upudev.nl`, { size: 8, color: grey });

  const pdfBytes = await pdfDoc.save();
  const filename = `sozlesme-${contractRow.id.slice(0, 8)}.pdf`;

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function buildFallbackText(cd: ContractData): string {
  // Pre-FAZ A sözleşmeleri için summary'den minimal metin üret
  return [
    "## YETKİLENDİRME SÖZLEŞMESİ",
    "",
    "**Mülk:**",
    `${cd.property_title || "—"}`,
    `Adres: ${cd.property_address || "—"}`,
    "",
    "**Mülk Sahibi:**",
    `${cd.owner_name || "—"}`,
    cd.owner_phone ? `Tel: ${cd.owner_phone}` : "",
    "",
    "**Şartlar:**",
    `Münhasırlık: ${cd.exclusive ? "Evet (münhasır yetki)" : "Hayır (paylaşımlı)"}`,
    `Komisyon: %${cd.commission ?? 2} + KDV`,
    `Süre: ${cd.duration ?? 3} ay`,
  ].filter(Boolean).join("\n");
}
