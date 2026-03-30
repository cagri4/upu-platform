import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, type, status, contract_data, signed_at, owner_signature_url, created_at")
    .eq("id", id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Sözleşme bulunamadı" }, { status: 404 });
  }

  const cd = contract.contract_data as Record<string, unknown>;

  // Build PDF using pdfkit
  const PDFDocument = (await import("pdfkit")).default;

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pdfDone = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Title
  doc.fontSize(20).font("Helvetica-Bold").text("Yetkilendirme Sozlesmesi", { align: "center" });
  doc.moveDown(1.5);

  // Contract details
  doc.fontSize(11).font("Helvetica");

  const addLine = (label: string, value: string) => {
    doc.font("Helvetica-Bold").text(label + ": ", { continued: true });
    doc.font("Helvetica").text(value || "-");
    doc.moveDown(0.3);
  };

  addLine("Sozlesme No", contract.id.slice(0, 8).toUpperCase());
  addLine("Tarih", new Date(contract.created_at).toLocaleDateString("tr-TR"));
  addLine("Durum", contract.signed_at ? "Imzalandi" : "Imza Bekliyor");

  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(13).text("Mulk Bilgileri");
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica");

  if (cd.property_title) addLine("Mulk", cd.property_title as string);
  addLine("Adres", (cd.property_address as string) || "-");

  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(13).text("Mulk Sahibi");
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica");

  addLine("Ad Soyad", (cd.owner_name as string) || "-");
  addLine("Telefon", (cd.owner_phone as string) || "-");

  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(13).text("Sozlesme Kosullari");
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica");

  addLine("Munhasirlik", (cd.exclusive as boolean) ? "Evet" : "Hayir");
  addLine("Komisyon", `%${cd.commission}+KDV`);
  addLine("Sure", `${cd.duration} ay`);

  // Signature section
  if (contract.signed_at) {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(13).text("Imza");
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica");
    addLine("Imza Tarihi", new Date(contract.signed_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }));

    // Try to embed signature image
    if (contract.owner_signature_url) {
      try {
        const imgRes = await fetch(contract.owner_signature_url);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          doc.moveDown(0.5);
          doc.image(imgBuffer, { width: 200, height: 80 });
        }
      } catch {
        doc.text("[Imza yuklenemedi]");
      }
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(9).fillColor("#999").text(
    "Bu belge UPU Platform tarafindan elektronik olarak olusturulmustur.",
    { align: "center" }
  );

  doc.end();
  const pdfBuffer = await pdfDone;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sozlesme-${contract.id.slice(0, 8)}.pdf"`,
    },
  });
}
