import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";

const ph = createPlaceholderHandler("siteyonetim");

export const siteyonetimCommands: TenantCommandRegistry = {
  commands: {
    borcum: ph("borcum", "Muhasebeci", "Borç durumu"),
    rapor: ph("rapor", "Muhasebeci", "Finansal rapor"),
    duyuru: ph("duyuru", "Sekreter", "Duyuru oluştur"),
    ariza: ph("ariza", "Teknisyen", "Arıza bildir"),
    hukuk: ph("hukuk", "Hukuk Müşaviri", "Hukuki danışma"),
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: { "borç": "borcum", "arıza": "ariza" },
};
