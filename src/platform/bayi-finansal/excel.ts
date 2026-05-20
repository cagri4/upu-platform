/**
 * Excel export helper — exceljs ile XLSX buffer üretir.
 *
 * Endpoint pattern: kolon başlıkları + satırlar geç, buffer dön. Caller
 * Response'a Content-Type + Content-Disposition ekler.
 */
import ExcelJS from "exceljs";

export interface ColumnDef<T> {
  header: string;
  key: keyof T & string;
  width?: number;
  /** Currency formatting için TRY kolonları. */
  money?: boolean;
}

export async function buildXlsx<T extends Record<string, unknown>>(args: {
  sheetName: string;
  columns: ColumnDef<T>[];
  rows: T[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "UPU Bayi";
  wb.created = new Date();

  const ws = wb.addWorksheet(args.sheetName);
  ws.columns = args.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 18,
    style: c.money ? { numFmt: '#,##0.00" ₺"' } : undefined,
  }));

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  ws.addRows(args.rows);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
