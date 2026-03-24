import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";

const ph = createPlaceholderHandler("muhasebe");

export const muhasebeCommands: TenantCommandRegistry = {
  commands: {
    fatura_yukle: ph("fatura_yukle", "Fatura Uzmanı", "Fatura yükle"),
    son_faturalar: ph("son_faturalar", "Fatura Uzmanı", "Son faturalar"),
    mukellefler: ph("mukellefler", "Sekreter", "Mükellef listesi"),
    takvim: ph("takvim", "Sekreter", "Beyanname takvimi"),
    brifing: ph("brifing", "Sekreter", "Günlük brifing"),
    kdv: ph("kdv", "Vergi Uzmanı", "KDV hesapla"),
    alacaklar: ph("alacaklar", "Tahsilat Uzmanı", "Alacak takibi"),
    geciken: ph("geciken", "Tahsilat Uzmanı", "Geciken ödemeler"),
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: { "fatura": "son_faturalar", "mükellef": "mukellefler" },
};
