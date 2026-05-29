/**
 * UPU Bayi KURUCU AI Eleman tool catalog — Faz 2.
 *
 * 8 tool:
 *  - kurucu_status                    (HAZIR durumu)
 *  - kurucu_add_dealer                (tek bayi, onay gerekmez)
 *  - kurucu_add_product               (tek ürün, onay gerekmez)
 *  - kurucu_preview_dealers_csv       (toplu parse → preview)
 *  - kurucu_commit_dealers            (onaylı toplu yaz)
 *  - kurucu_preview_products_csv      (toplu parse → preview)
 *  - kurucu_commit_products           (onaylı toplu yaz)
 *  - kurucu_request_wa_handoff        (KAÇIŞ KAPISI)
 *
 * Diğer rollerin (yonetici, egitmen) tool seti Faz 3'te tanımlanacak.
 * Yonetici = mevcut BAYI_TOOLS (salt-okur ağırlıklı), Egitmen = sıfır
 * write tool (yalnız panel-routing önerileri).
 */
import type { ToolDef } from "@/platform/agent/types";
import { kurucuStatusTool } from "./status";
import { kurucuAddDealerTool } from "./add-dealer";
import { kurucuAddProductTool } from "./add-product";
import { kurucuPreviewDealersTool } from "./preview-dealers";
import { kurucuCommitDealersTool } from "./commit-dealers";
import { kurucuPreviewProductsTool } from "./preview-products";
import { kurucuCommitProductsTool } from "./commit-products";
import { kurucuRequestWaHandoffTool } from "./wa-handoff";

export const BAYI_KURUCU_TOOLS: ToolDef[] = [
  kurucuStatusTool,
  kurucuAddDealerTool,
  kurucuAddProductTool,
  kurucuPreviewDealersTool,
  kurucuCommitDealersTool,
  kurucuPreviewProductsTool,
  kurucuCommitProductsTool,
  kurucuRequestWaHandoffTool,
];

export const BAYI_KURUCU_TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  BAYI_KURUCU_TOOLS.map(t => [t.name, t]),
);
