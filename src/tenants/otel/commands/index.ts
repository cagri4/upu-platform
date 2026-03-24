import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";

const ph = createPlaceholderHandler("otel");

export const otelCommands: TenantCommandRegistry = {
  commands: {
    misafirler: ph("misafirler", "Resepsiyon", "Misafir listesi"),
    mesajlar: ph("mesajlar", "Resepsiyon", "Gelen mesajlar"),
    rezervasyonlar: ph("rezervasyonlar", "Rezervasyon", "Rezervasyonlar"),
    checkin: ph("checkin", "Rezervasyon", "Check-in"),
    checkout: ph("checkout", "Rezervasyon", "Check-out"),
    musaitlik: ph("musaitlik", "Rezervasyon", "Müsaitlik"),
    odalar: ph("odalar", "Kat Hizmetleri", "Oda durumu"),
    temizlik: ph("temizlik", "Kat Hizmetleri", "Temizlik görevi"),
    brifing: ph("brifing", "Misafir Deneyimi", "Günlük brifing"),
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: { "oda": "odalar", "rezervasyon": "rezervasyonlar" },
};
