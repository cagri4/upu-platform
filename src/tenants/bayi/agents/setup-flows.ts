/**
 * Bayi — UPU setup flow (single assistant).
 *
 * Previously there were 8 setup flows, one per "virtual employee". After
 * the pivot there is only UPU: one assistant, per-user capability-based
 * menu. Setup asks a few tercihler for the owner's briefing behavior.
 *
 * NOTE: Kept same file path/exports referenced by app/api/whatsapp/route.ts
 * but reduced to a single flow. Legacy exports are aliases of upuSetup so
 * any stale import keeps working until we refactor the whatsapp route.
 */

import type { AgentSetupFlow } from "@/platform/agents/setup";

export const upuSetup: AgentSetupFlow = {
  agentKey: "bayi_upu",
  agentName: "UPU",
  agentIcon: "🤖",
  greeting:
    "Merhaba! Ben UPU — bayi yönetim platformunun kişisel asistanıyım. Sipariş, stok, tahsilat, kampanya, teslimat; ne gerekiyorsa buradan hallederiz.\n\nBirkaç tercih belirleyelim:",
  questions: [
    {
      key: "brifing_saat",
      text: "Sabah brifingini saat kaçta göndereyim?",
      buttons: [
        { id: "07:30", title: "07:30" },
        { id: "08:30", title: "08:30" },
        { id: "09:00", title: "09:00" },
      ],
    },
    {
      key: "gecikme_esigi",
      text: "Vadesi geçen ödemeler için uyarı eşiği kaç gün olsun?",
      buttons: [
        { id: "7", title: "7 gün" },
        { id: "15", title: "15 gün" },
        { id: "30", title: "30 gün" },
      ],
    },
    {
      key: "kritik_stok_bildirimi",
      text: "Kritik stok uyarısı göndereyim mi?",
      buttons: [
        { id: "evet", title: "Evet" },
        { id: "hayir", title: "Hayır" },
      ],
    },
  ],
  onComplete: (config) => {
    let summary = "";
    summary += `⏰ Brifing saati: ${config.brifing_saat}\n`;
    summary += `📊 Gecikme eşiği: ${config.gecikme_esigi} gün\n`;
    summary += `🔔 Kritik stok uyarısı: ${config.kritik_stok_bildirimi === "evet" ? "Aktif" : "Kapalı"}`;
    return summary;
  },
};

// Legacy aliases — existing imports in app/api/whatsapp/route.ts reference
// these names. Each old employee key still resolves to the same UPU
// questions/copy so setup-triggered from "emp:<oldKey>" buttons keeps
// working until the employee menu is replaced by the capability menu
// (Phase 2).
function aliasAs(agentKey: string): AgentSetupFlow {
  return { ...upuSetup, agentKey };
}

export const asistanSetup = aliasAs("bayi_asistan");
export const satisMuduruSetup = aliasAs("bayi_satisMuduru");
export const satisTemsilcisiSetup = aliasAs("bayi_satisTemsilcisi");
export const muhasebeciSetup = aliasAs("bayi_muhasebeci");
export const tahsildarSetup = aliasAs("bayi_tahsildar");
export const depocuSetup = aliasAs("bayi_depocu");
export const lojistikciSetup = aliasAs("bayi_lojistikci");
export const urunYoneticisiSetup = aliasAs("bayi_urunYoneticisi");
