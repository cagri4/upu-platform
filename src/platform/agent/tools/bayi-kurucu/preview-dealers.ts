import { assertTenant, type ToolDef } from "@/platform/agent/types";
import { parseDealersText } from "./parse-helpers";
import { randomBytes } from "crypto";

export const kurucuPreviewDealersTool: ToolDef = {
  name: "kurucu_preview_dealers_csv",
  description: "Kopyala-yapıştır TSV/CSV bayi metnini parse eder ve PREVIEW döner — DB'ye YAZMAZ. Header satırı zorunlu (ad, telefon, sehir vs.). Sonuç: parsed_count + skipped + ilk 5 satır + header eşleme. LLM kullanıcıya gösterir, onay alınca kurucu_commit_dealers çağırır.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Tablonun ham metni (header satırı dahil, satır başı LF, sütun ayırıcı TAB/virgül/noktalı virgül)." },
    },
    required: ["text"],
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "kurucu_preview_dealers_csv");
    const text = String(input.text || "");
    if (!text.trim()) return { ok: false, error: "Boş metin." };

    const r = parseDealersText(text);
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
      rows: r.rows,  // commit tool buna gerek duyacak — LLM result'tan okuyup commit_dealers'a iletir
      instruction: r.rows.length === 0
        ? "Hiç satır parse edilemedi. Kullanıcıya header'ı ve örnek satırı sor; sütun eşlemeyi kontrol et."
        : `${r.rows.length} bayi parse edildi${r.skipped.length > 0 ? `, ${r.skipped.length} satır atlandı` : ""}. Kullanıcıya ilk 3-5 satırı göster + atlama sebeplerini özetle + ONAY iste; onay sonrası kurucu_commit_dealers çağır (rows alanını aynen ilet).`,
    };
  },
};
