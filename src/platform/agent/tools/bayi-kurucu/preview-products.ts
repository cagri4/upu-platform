import { assertTenant, type ToolDef } from "@/platform/agent/types";
import { parseProductsText } from "./parse-helpers";
import { randomBytes } from "crypto";

export const kurucuPreviewProductsTool: ToolDef = {
  name: "kurucu_preview_products_csv",
  description: "Kopyala-yapıştır TSV/CSV ürün metnini parse eder ve PREVIEW döner — DB'ye YAZMAZ. Header satırı zorunlu (urun adi, fiyat, kategori vs.). LLM kullanıcıya gösterir, onay alınca kurucu_commit_products çağırır.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Tablonun ham metni (header satırı dahil)." },
    },
    required: ["text"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_preview_products_csv");
    const text = String(input.text || "");
    if (!text.trim()) return { ok: false, error: "Boş metin." };

    const r = parseProductsText(text);
    const preview_token = randomBytes(6).toString("hex");

    return {
      ok: true,
      preview_token,
      parsed_count: r.rows.length,
      skipped_count: r.skipped.length,
      detected_delimiter: r.detected_delimiter === "\t" ? "TAB" : r.detected_delimiter,
      header_map: r.header_map,
      unmapped_columns: r.unmapped_columns,
      sample: r.rows.slice(0, 5),
      skipped: r.skipped.slice(0, 10),
      rows: r.rows,
      instruction: r.rows.length === 0
        ? "Hiç ürün parse edilemedi. Header satırını ve örnek satırı kullanıcıdan iste."
        : `${r.rows.length} ürün parse edildi${r.skipped.length > 0 ? `, ${r.skipped.length} atlandı` : ""}. Kullanıcıya örnek + atlama sebepleri göster, ONAY iste, sonra kurucu_commit_products çağır (rows alanını ilet).`,
    };
  },
};
