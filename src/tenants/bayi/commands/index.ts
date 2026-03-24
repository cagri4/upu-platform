import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";

const ph = createPlaceholderHandler("bayi");

export const bayiCommands: TenantCommandRegistry = {
  commands: {
    ozet: ph("ozet", "Asistan", "Günlük özet"),
    siparisler: ph("siparisler", "Satış Temsilcisi", "Sipariş listesi"),
    siparisOlustur: ph("siparisOlustur", "Satış Temsilcisi", "Yeni sipariş"),
    bakiye: ph("bakiye", "Muhasebeci", "Bakiye sorgula"),
    stok: ph("stok", "Depocu", "Stok durumu"),
    urunler: ph("urunler", "Ürün Yöneticisi", "Ürün kataloğu"),
    kampanyalar: ph("kampanyalar", "Satış Müdürü", "Kampanyalar"),
    bayidurum: ph("bayidurum", "Satış Temsilcisi", "Bayi durumu"),
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: { "sipariş": "siparisler", "ürünler": "urunler" },
};
