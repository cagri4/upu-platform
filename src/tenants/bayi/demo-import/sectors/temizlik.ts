/**
 * Kişisel Bakım & Temizlik sektörü demo dataset.
 *
 * 5 bayi (1 KRİTİK), 5 kategori, 20 ürün, 7 sipariş, 3 vade hareketi.
 */

import type { SectorDataset } from "./types";

const CATEGORIES = [
  "Sabun & Şampuan",
  "Deterjan",
  "Yüzey Temizlik",
  "Kağıt Ürünleri",
  "Dezenfektan",
];

export const temizlikDataset: SectorDataset = {
  slug: "temizlik",
  label: "Kişisel Bakım & Temizlik",
  categories: CATEGORIES,

  products: [
    // Sabun & Şampuan (4)
    { name: "Dalan Sıvı Sabun 5L", code: "SAB-DLN-SIV-5", category: "Sabun & Şampuan", unit: "bidon", unit_price: 145, stock_quantity: 180, brand: "Dalan", vat_rate: 8, ean: "8690999500101" },
    { name: "Hacı Şakir Kalıp Sabun 1kg", code: "SAB-HCS-KAL-1", category: "Sabun & Şampuan", unit: "paket", unit_price: 38, stock_quantity: 320, brand: "Hacı Şakir", vat_rate: 8, ean: null },
    { name: "Elidor Şampuan 650ml", code: "SAB-ELD-SMP-65", category: "Sabun & Şampuan", unit: "şişe", unit_price: 85, stock_quantity: 240, brand: "Elidor", vat_rate: 18, ean: null },
    { name: "Pantene Şampuan 600ml", code: "SAB-PNT-SMP-60", category: "Sabun & Şampuan", unit: "şişe", unit_price: 145, stock_quantity: 180, brand: "Pantene", vat_rate: 18, ean: null },

    // Deterjan (4)
    { name: "Persil Sıvı Çamaşır 5L", code: "DET-PRS-SIV-5", category: "Deterjan", unit: "bidon", unit_price: 320, stock_quantity: 140, brand: "Persil", vat_rate: 18, ean: null },
    { name: "Ariel Toz Çamaşır 7.5kg", code: "DET-ARL-TOZ-75", category: "Deterjan", unit: "kova", unit_price: 285, stock_quantity: 120, brand: "Ariel", vat_rate: 18, ean: null },
    { name: "Pril Bulaşık Deterjanı 1L", code: "DET-PRL-BLS-1", category: "Deterjan", unit: "şişe", unit_price: 65, stock_quantity: 320, brand: "Pril", vat_rate: 18, ean: null },
    { name: "Finish Bulaşık Tableti 60'lı", code: "DET-FNS-TBL-60", category: "Deterjan", unit: "kutu", unit_price: 245, stock_quantity: 90, brand: "Finish", vat_rate: 18, ean: null },

    // Yüzey Temizlik (4)
    { name: "Cif Krem Yüzey 750ml", code: "YUZ-CIF-KRM-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 58, stock_quantity: 280, brand: "Cif", vat_rate: 18, ean: null },
    { name: "Mr. Proper Cam Sprey 750ml", code: "YUZ-MRP-CAM-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 48, stock_quantity: 320, brand: "Mr. Proper", vat_rate: 18, ean: null },
    { name: "Domestos Tuvalet Temizleyici 750ml", code: "YUZ-DOM-TUV-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 52, stock_quantity: 280, brand: "Domestos", vat_rate: 18, ean: null },
    { name: "Ajax Genel Temizleyici 1.5L", code: "YUZ-AJX-GNL-15", category: "Yüzey Temizlik", unit: "şişe", unit_price: 68, stock_quantity: 200, brand: "Ajax", vat_rate: 18, ean: null },

    // Kağıt Ürünleri (4)
    { name: "Selpak Tuvalet Kağıdı 32'li", code: "KGT-SLP-TUV-32", category: "Kağıt Ürünleri", unit: "paket", unit_price: 220, stock_quantity: 180, brand: "Selpak", vat_rate: 18, ean: null },
    { name: "Lila Tuvalet Kağıdı 24'lü", code: "KGT-LIL-TUV-24", category: "Kağıt Ürünleri", unit: "paket", unit_price: 145, stock_quantity: 220, brand: "Lila", vat_rate: 18, ean: null },
    { name: "Solo Kağıt Havlu 12'li", code: "KGT-SOL-HVL-12", category: "Kağıt Ürünleri", unit: "paket", unit_price: 125, stock_quantity: 200, brand: "Solo", vat_rate: 18, ean: null },
    { name: "Selpak Mendil 100'lü 6'lı Set", code: "KGT-SLP-MEN-6", category: "Kağıt Ürünleri", unit: "set", unit_price: 38, stock_quantity: 380, brand: "Selpak", vat_rate: 18, ean: null },

    // Dezenfektan (4)
    { name: "Dezenfektan Sprey 500ml", code: "DZN-SPR-50", category: "Dezenfektan", unit: "şişe", unit_price: 68, stock_quantity: 280, brand: "Dettol", vat_rate: 18, ean: null },
    { name: "El Dezenfektanı Jel 500ml", code: "DZN-JEL-50", category: "Dezenfektan", unit: "şişe", unit_price: 85, stock_quantity: 240, brand: "Dettol", vat_rate: 18, ean: null },
    { name: "Çamaşır Suyu 4L", code: "DZN-CMS-4", category: "Dezenfektan", unit: "bidon", unit_price: 68, stock_quantity: 180, brand: "Domestos", vat_rate: 18, ean: null },
    { name: "Yüzey Dezenfektan 5L Konsantre", code: "DZN-YZ-5", category: "Dezenfektan", unit: "bidon", unit_price: 240, stock_quantity: 80, brand: "Dettol", vat_rate: 18, ean: null },
  ],

  dealers: [
    {
      name: "Hijyen Toptan", city: "Ankara", district: "Etimesgut", country: "TR",
      contact_name: "Mehmet Hijyen", contact_phone: "905321150001", email: "info@hijyentoptan.com",
      address_line: "Eryaman Çarşı Cad. 22", is_active: true, balance: 3400,
      tax_number: "5234567890", tax_office: "Etimesgut Vergi Dairesi",
      iban: "TR230004600118123456789012", credit_limit: 14000, payment_term_days: 60,
      discount_rate: 10, risk_status: "clean", tags: ["VIP"],
      status_note: "Düzenli alım",
    },
    {
      name: "Aytaç Market", city: "Bursa", district: "Osmangazi", country: "TR",
      contact_name: "Aytaç Yıldız", contact_phone: "905321150002", email: "aytac@aytacmarket.com",
      address_line: "Heykel Mah. 10. Sok. 7", is_active: true, balance: 1850,
      tax_number: "5234567891", tax_office: "Osmangazi Vergi Dairesi",
      iban: "TR890010009912345678905555", credit_limit: 6000, payment_term_days: 45,
      discount_rate: 7, risk_status: "clean", tags: [],
      status_note: "Düzenli, küçük cari",
    },
    {
      name: "Yılmaz Temizlik", city: "Adana", district: "Yüreğir", country: "TR",
      contact_name: "Veli Yılmaz", contact_phone: "905321150003", email: "veli@yilmaztemizlik.com",
      address_line: "Cumhuriyet Bulvarı 156", is_active: true, balance: 8500,
      tax_number: "5234567892", tax_office: "Yüreğir Vergi Dairesi",
      iban: "TR670006400000999988877766", credit_limit: 10000, payment_term_days: 30,
      discount_rate: 5, risk_status: "watch", tags: ["kritik"],
      status_note: "KRİTİK — 12 gün geçmiş vade",
    },
    {
      name: "Mehmet Hijyen Tek.", city: "Konya", district: "Selçuklu", country: "TR",
      contact_name: "Mehmet Tezcan", contact_phone: "905321150004", email: "mehmet@mehmethijyen.com",
      address_line: "Yenişehir Mah. 8. Cad. 41", is_active: true, balance: 920,
      tax_number: "5234567893", tax_office: "Selçuklu Vergi Dairesi",
      iban: "", credit_limit: 4000, payment_term_days: 30, discount_rate: 0,
      risk_status: "clean", tags: ["yeni"],
      status_note: "Yeni cari, büyüyor",
    },
    {
      name: "Asya Bakım Ürünleri", city: "İstanbul", district: "Maltepe", country: "TR",
      contact_name: "Asya Demirtaş", contact_phone: "905321150005", email: "asya@asyabakim.com.tr",
      address_line: "Bağlarbaşı Mah. 15. Sok. 9", is_active: true, balance: 5200,
      tax_number: "5234567894", tax_office: "Maltepe Vergi Dairesi",
      iban: "TR140012300055544433322211", credit_limit: 22000, payment_term_days: 90,
      discount_rate: 13, risk_status: "clean", tags: ["VIP", "kurumsal"],
      status_note: "Büyük zincir, kurumsal",
    },
  ],

  orders: [
    { dealer_index: 0, product_index: 0,  quantity: 30, status: "delivered",  days_ago: 13 },
    { dealer_index: 0, product_index: 8,  quantity: 24, status: "delivered",  days_ago: 6 },
    { dealer_index: 2, product_index: 12, quantity: 18, status: "delivered",  days_ago: 17 },
    { dealer_index: 4, product_index: 4,  quantity: 40, status: "shipped",    days_ago: 4 },
    { dealer_index: 4, product_index: 16, quantity: 25, status: "preparing",  days_ago: 1 },
    { dealer_index: 1, product_index: 6,  quantity: 24, status: "preparing",  days_ago: 2 },
    { dealer_index: 3, product_index: 13, quantity: 12, status: "pending",    days_ago: 0 },
  ],

  invoices: [
    { dealer_index: 2, amount: 8500, is_paid: false, due_days_offset: -12 },
    { dealer_index: 4, amount: 5200, is_paid: false, due_days_offset: 5 },
    { dealer_index: 1, amount: 1850, is_paid: true,  due_days_offset: -7 },
  ],
};
