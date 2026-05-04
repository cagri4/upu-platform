/**
 * Hırdavat & İnşaat sektörü demo dataset.
 *
 * 5 bayi (1 KRİTİK), 5 kategori, 20 ürün, 7 sipariş, 3 vade hareketi.
 */

import type { SectorDataset } from "./types";

const CATEGORIES = [
  "El Aletleri",
  "Vida & Bağlantı",
  "Sarf Malzeme",
  "Boya Aletleri",
  "Güvenlik",
];

export const hirdavatDataset: SectorDataset = {
  slug: "hirdavat",
  label: "Hırdavat & İnşaat",
  categories: CATEGORIES,

  products: [
    // El Aletleri (4)
    { name: "Bosch GBM 18V-21 Akülü Matkap", code: "ALT-BSC-MAT-18", category: "El Aletleri", unit: "adet", unit_price: 4250, stock_quantity: 24, brand: "Bosch", vat_rate: 20, ean: "3165140987001" },
    { name: "Stanley Çekiç 500g Çelik Saplı", code: "ALT-STN-CKC-500", category: "El Aletleri", unit: "adet", unit_price: 185, stock_quantity: 80, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Makita Avuç Taşlama 850W", code: "ALT-MAK-AVUC-85", category: "El Aletleri", unit: "adet", unit_price: 1850, stock_quantity: 18, brand: "Makita", vat_rate: 20, ean: null },
    { name: "Bosch Lazer Hizalama Cihazı", code: "ALT-BSC-LZR-HIZ", category: "El Aletleri", unit: "adet", unit_price: 980, stock_quantity: 12, brand: "Bosch", vat_rate: 20, ean: null },

    // Vida & Bağlantı (4)
    { name: "Vida 5×60mm 100'lü Paket", code: "VID-5-60-100", category: "Vida & Bağlantı", unit: "paket", unit_price: 75, stock_quantity: 320, brand: "Bossard", vat_rate: 20, ean: null },
    { name: "Plastik Dübel 6mm 100'lü", code: "VID-DBL-6-100", category: "Vida & Bağlantı", unit: "paket", unit_price: 38, stock_quantity: 480, brand: "Fischer", vat_rate: 20, ean: null },
    { name: "M8 × 40 Galvaniz Cıvata 250'li", code: "VID-M8-40-250", category: "Vida & Bağlantı", unit: "paket", unit_price: 145, stock_quantity: 180, brand: "Bossard", vat_rate: 20, ean: null },
    { name: "Çatı Vidası 6.3 × 100mm 50'li", code: "VID-CAT-100-50", category: "Vida & Bağlantı", unit: "paket", unit_price: 98, stock_quantity: 140, brand: "Spax", vat_rate: 20, ean: null },

    // Sarf Malzeme (4)
    { name: "Akrilik Mastik Beyaz 310ml", code: "SRF-MST-AKR-31", category: "Sarf Malzeme", unit: "tüp", unit_price: 32, stock_quantity: 380, brand: "Soudal", vat_rate: 20, ean: null },
    { name: "Sika Polimer Yapıştırıcı 290ml", code: "SRF-SIK-POL-29", category: "Sarf Malzeme", unit: "tüp", unit_price: 65, stock_quantity: 240, brand: "Sika", vat_rate: 20, ean: null },
    { name: "Maket Bıçağı 18mm 10'lu", code: "SRF-MKT-BIC-18", category: "Sarf Malzeme", unit: "paket", unit_price: 28, stock_quantity: 520, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Bant Gri Tamir 48mm × 25m", code: "SRF-BNT-GRI-48", category: "Sarf Malzeme", unit: "rulo", unit_price: 42, stock_quantity: 280, brand: "3M", vat_rate: 20, ean: null },

    // Boya Aletleri (4)
    { name: "Boya Rulo 25cm Kısa Tüy", code: "BOY-RUL-25-KSA", category: "Boya Aletleri", unit: "adet", unit_price: 22, stock_quantity: 420, brand: "Bosch", vat_rate: 20, ean: null },
    { name: "Boya Fırçası 4'lü Set Çeşitli", code: "BOY-FRC-4-SET", category: "Boya Aletleri", unit: "set", unit_price: 58, stock_quantity: 240, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Plastik Boya Tepsisi 25cm", code: "BOY-TEP-PL-25", category: "Boya Aletleri", unit: "adet", unit_price: 18, stock_quantity: 380, brand: "Tamirini", vat_rate: 20, ean: null },
    { name: "Spatula Plastik 10cm", code: "BOY-SPT-10", category: "Boya Aletleri", unit: "adet", unit_price: 14, stock_quantity: 520, brand: "Tamirini", vat_rate: 20, ean: null },

    // Güvenlik (4)
    { name: "Eldiven Tek Sefer Lateks 100'lü", code: "GUV-ELD-LAT-100", category: "Güvenlik", unit: "kutu", unit_price: 145, stock_quantity: 280, brand: "3M", vat_rate: 20, ean: null },
    { name: "FFP2 Toz Maskesi 10'lu", code: "GUV-MSK-FFP2-10", category: "Güvenlik", unit: "paket", unit_price: 85, stock_quantity: 320, brand: "3M", vat_rate: 20, ean: null },
    { name: "İş Eldiveni Naylon Çift", code: "GUV-ELD-NAY-CFT", category: "Güvenlik", unit: "çift", unit_price: 28, stock_quantity: 480, brand: "3M", vat_rate: 20, ean: null },
    { name: "Koruma Gözlüğü Şeffaf", code: "GUV-GOZ-SEF", category: "Güvenlik", unit: "adet", unit_price: 65, stock_quantity: 180, brand: "Uvex", vat_rate: 20, ean: null },
  ],

  dealers: [
    { name: "İnşaat Toptan",       city: "Ankara",   country: "TR", contact_name: "Mehmet İnan",     contact_phone: "905321130001", is_active: true, balance: 3800, status_note: "Düzenli, orta hacim" },
    { name: "Yapı Market Hasan",   city: "Bursa",    country: "TR", contact_name: "Hasan Yıldız",    contact_phone: "905321130002", is_active: true, balance: 1450, status_note: "Düzenli alım" },
    { name: "Demir Hırdavat",      city: "Adana",    country: "TR", contact_name: "Ahmet Demir",     contact_phone: "905321130003", is_active: true, balance: 8500, status_note: "KRİTİK — 12 gün geçmiş vade" },
    { name: "Çelik Vidalı Toptan", city: "İstanbul", country: "TR", contact_name: "Selim Çelik",     contact_phone: "905321130004", is_active: true, balance: 6200, status_note: "Büyük hacim, kurumsal" },
    { name: "Mehmet Yapı Market",  city: "İzmir",    country: "TR", contact_name: "Mehmet Tezcan",   contact_phone: "905321130005", is_active: true, balance: 720,  status_note: "Küçük cari, düzenli ödeyici" },
  ],

  orders: [
    { dealer_index: 0, product_index: 4,  quantity: 24, status: "delivered",  days_ago: 13 },
    { dealer_index: 0, product_index: 8,  quantity: 12, status: "delivered",  days_ago: 7 },
    { dealer_index: 2, product_index: 0,  quantity: 4,  status: "delivered",  days_ago: 18 },
    { dealer_index: 3, product_index: 16, quantity: 40, status: "shipped",    days_ago: 3 },
    { dealer_index: 3, product_index: 5,  quantity: 60, status: "preparing",  days_ago: 1 },
    { dealer_index: 1, product_index: 12, quantity: 30, status: "preparing",  days_ago: 2 },
    { dealer_index: 4, product_index: 17, quantity: 8,  status: "pending",    days_ago: 0 },
  ],

  invoices: [
    { dealer_index: 2, amount: 8500, is_paid: false, due_days_offset: -12 },
    { dealer_index: 3, amount: 6200, is_paid: false, due_days_offset: 5 },
    { dealer_index: 4, amount: 720,  is_paid: true,  due_days_offset: -7 },
  ],
};
