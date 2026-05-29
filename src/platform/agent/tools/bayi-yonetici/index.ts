/**
 * UPU Bayi YÖNETİCİ ASISTANI tool catalog — Faz 3 (E).
 *
 * KOD DÜZEYİNDE YETKİ SINIRI: bu set SALT-OKU.
 *
 * BAYI_TOOLS'tan AYIKLANAN:
 *   ❌ send_dealer_message      (WRITE — WA gönderir, Yönetici yazamaz)
 *
 * Yazma yetkili tüm tool'lar Kurucu rolüne ait (BAYI_KURUCU_TOOLS).
 * Yönetici sadece veri sorgular, rapor hazırlar, soruları yanıtlar —
 * ASLA insert/update/delete yapmaz, ASLA mesaj göndermez, ASLA
 * konfigürasyon değiştirmez.
 *
 * Defense-in-depth: explicit whitelist; yeni bir BAYI_TOOL eklenirse
 * otomatik olarak Yönetici'ye GİTMEZ — burada elle eklemek gerekir.
 * Bu, "yeni yazma tool eklendi, yanlışlıkla Yönetici de erişti" hatasını
 * derleme zamanı yerine code-review zamanına alır (daha güvenli).
 */
import type { ToolDef } from "@/platform/agent/types";
import { listOrdersTool } from "../bayi/list-orders";
import { getKpiSummaryTool } from "../bayi/get-kpi-summary";
import { getAccountStatementTool } from "../bayi/get-account-statement";
import { listOverdueInvoicesTool } from "../bayi/list-overdue-invoices";
import { getDealerScoreTool } from "../bayi/get-dealer-score";
import { getChurnRisksTool } from "../bayi/get-churn-risks";
import { suggestCrossSellTool } from "../bayi/suggest-cross-sell";
import { getRecommendationsTool } from "../bayi/get-recommendations";

export const BAYI_YONETICI_TOOLS: ToolDef[] = [
  listOrdersTool,
  getKpiSummaryTool,
  getAccountStatementTool,
  listOverdueInvoicesTool,
  getDealerScoreTool,
  getChurnRisksTool,
  suggestCrossSellTool,
  getRecommendationsTool,
];

export const BAYI_YONETICI_TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  BAYI_YONETICI_TOOLS.map(t => [t.name, t]),
);
