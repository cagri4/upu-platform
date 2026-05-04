/**
 * Gıda & Bakliyat sektörü demo dataset.
 *
 * 5 bayi (1 KRİTİK), 5 kategori, 20 ürün, 7 sipariş, 3 vade hareketi.
 */

import type { SectorDataset } from "./types";

const CATEGORIES = [
  "Bakliyat",
  "Un & Bulgur",
  "Pirinç & Makarna",
  "Yağ & Sıvılar",
  "Salça & Konserve",
];

export const gidaDataset: SectorDataset = {
  slug: "gida",
  label: "Gıda & Bakliyat",
  categories: CATEGORIES,

  products: [
    // Bakliyat (4)
    { name: "Reis Yeşil Mercimek 5kg", code: "BAK-REIS-MER-5", category: "Bakliyat", unit: "torba", unit_price: 285, stock_quantity: 180, brand: "Reis", vat_rate: 1, ean: "8690999100101" },
    { name: "Yayla Nohut 5kg", code: "BAK-YAY-NOH-5", category: "Bakliyat", unit: "torba", unit_price: 320, stock_quantity: 220, brand: "Yayla", vat_rate: 1, ean: "8690999100102" },
    { name: "Reis Kuru Fasulye 5kg", code: "BAK-REIS-FAS-5", category: "Bakliyat", unit: "torba", unit_price: 410, stock_quantity: 140, brand: "Reis", vat_rate: 1, ean: "8690999100103" },
    { name: "Yayla Kırmızı Mercimek 5kg", code: "BAK-YAY-KIR-5", category: "Bakliyat", unit: "torba", unit_price: 295, stock_quantity: 200, brand: "Yayla", vat_rate: 1, ean: null },

    // Un & Bulgur (4)
    { name: "Söke Buğday Unu 5kg", code: "UNB-SOK-UN-5", category: "Un & Bulgur", unit: "torba", unit_price: 185, stock_quantity: 240, brand: "Söke", vat_rate: 1, ean: "8690999100201" },
    { name: "Yayla Köftelik Bulgur 5kg", code: "UNB-YAY-KOF-5", category: "Un & Bulgur", unit: "torba", unit_price: 215, stock_quantity: 160, brand: "Yayla", vat_rate: 1, ean: null },
    { name: "Reis Pilavlık Bulgur 5kg", code: "UNB-REIS-PIL-5", category: "Un & Bulgur", unit: "torba", unit_price: 220, stock_quantity: 140, brand: "Reis", vat_rate: 1, ean: null },
    { name: "Söke Tam Buğday Unu 5kg", code: "UNB-SOK-TAM-5", category: "Un & Bulgur", unit: "torba", unit_price: 210, stock_quantity: 90, brand: "Söke", vat_rate: 1, ean: null },

    // Pirinç & Makarna (4)
    { name: "Reis Baldo Pirinç 5kg", code: "PRC-REIS-BLD-5", category: "Pirinç & Makarna", unit: "torba", unit_price: 480, stock_quantity: 200, brand: "Reis", vat_rate: 1, ean: "8690999100301" },
    { name: "Reis Osmancık Pirinç 5kg", code: "PRC-REIS-OSM-5", category: "Pirinç & Makarna", unit: "torba", unit_price: 420, stock_quantity: 180, brand: "Reis", vat_rate: 1, ean: null },
    { name: "Filiz Spagetti 1kg", code: "PRC-FIL-SPG-1", category: "Pirinç & Makarna", unit: "paket", unit_price: 38, stock_quantity: 600, brand: "Filiz", vat_rate: 1, ean: null },
    { name: "Barilla Penne 500g", code: "PRC-BAR-PNE-5", category: "Pirinç & Makarna", unit: "paket", unit_price: 52, stock_quantity: 480, brand: "Barilla", vat_rate: 1, ean: null },

    // Yağ & Sıvılar (4)
    { name: "Komili Zeytinyağı 5L Teneke", code: "YAG-KOM-ZEY-5", category: "Yağ & Sıvılar", unit: "teneke", unit_price: 1850, stock_quantity: 60, brand: "Komili", vat_rate: 8, ean: "8690999100401" },
    { name: "Yudum Ayçiçek Yağı 5L", code: "YAG-YUD-AYC-5", category: "Yağ & Sıvılar", unit: "teneke", unit_price: 720, stock_quantity: 90, brand: "Yudum", vat_rate: 8, ean: null },
    { name: "Komili Riviera Zeytinyağı 1L", code: "YAG-KOM-RIV-1", category: "Yağ & Sıvılar", unit: "şişe", unit_price: 380, stock_quantity: 150, brand: "Komili", vat_rate: 8, ean: null },
    { name: "Sırma Doğal Su 1.5L (6'lı)", code: "YAG-SRM-SU-15", category: "Yağ & Sıvılar", unit: "koli", unit_price: 65, stock_quantity: 280, brand: "Sırma", vat_rate: 1, ean: null },

    // Salça & Konserve (4)
    { name: "Tat Domates Salçası 4kg Teneke", code: "SAL-TAT-DOM-4", category: "Salça & Konserve", unit: "teneke", unit_price: 320, stock_quantity: 100, brand: "Tat", vat_rate: 8, ean: "8690999100501" },
    { name: "Tat Biber Salçası 700g", code: "SAL-TAT-BIB-7", category: "Salça & Konserve", unit: "kavanoz", unit_price: 78, stock_quantity: 240, brand: "Tat", vat_rate: 8, ean: null },
    { name: "Tukaş Konserve Bezelye 800g", code: "SAL-TUK-BEZ-8", category: "Salça & Konserve", unit: "kutu", unit_price: 45, stock_quantity: 360, brand: "Tukaş", vat_rate: 8, ean: null },
    { name: "Penguen Domates Püresi 700g", code: "SAL-PEN-DPR-7", category: "Salça & Konserve", unit: "kavanoz", unit_price: 52, stock_quantity: 200, brand: "Penguen", vat_rate: 8, ean: null },
  ],

  dealers: [
    { name: "Anadolu Gıda Toptan", city: "Adana",    country: "TR", contact_name: "Mehmet Akın",     contact_phone: "905321120001", is_active: true, balance: 3200, status_note: "Düzenli alım" },
    { name: "Mehmet Bakkal",        city: "Konya",    country: "TR", contact_name: "Mehmet Tezcan",   contact_phone: "905321120002", is_active: true, balance: 480,  status_note: "Küçük dükkan, haftalık alım" },
    { name: "Ege Toptan Gıda",      city: "İzmir",    country: "TR", contact_name: "Hasan Yenice",    contact_phone: "905321120003", is_active: true, balance: 9200, status_note: "KRİTİK — 14 gün geçmiş vade" },
    { name: "Yılmaz Gıda",          city: "Bursa",    country: "TR", contact_name: "Veli Yılmaz",     contact_phone: "905321120004", is_active: true, balance: 1850, status_note: "Düzenli, normal cari" },
    { name: "Aysu Market Zinciri",  city: "İstanbul", country: "TR", contact_name: "Aysu Demirtaş",   contact_phone: "905321120005", is_active: true, balance: 5400, status_note: "Büyük zincir, aylık ödeyici" },
  ],

  orders: [
    { dealer_index: 0, product_index: 0,  quantity: 30, status: "delivered",  days_ago: 11 },
    { dealer_index: 0, product_index: 8,  quantity: 18, status: "delivered",  days_ago: 5 },
    { dealer_index: 2, product_index: 12, quantity: 24, status: "delivered",  days_ago: 17 },
    { dealer_index: 4, product_index: 16, quantity: 40, status: "shipped",    days_ago: 4 },
    { dealer_index: 4, product_index: 1,  quantity: 50, status: "preparing",  days_ago: 1 },
    { dealer_index: 3, product_index: 4,  quantity: 25, status: "preparing",  days_ago: 2 },
    { dealer_index: 1, product_index: 10, quantity: 12, status: "pending",    days_ago: 0 },
  ],

  invoices: [
    { dealer_index: 2, amount: 9200, is_paid: false, due_days_offset: -14 },
    { dealer_index: 4, amount: 5400, is_paid: false, due_days_offset: 6 },
    { dealer_index: 1, amount: 480,  is_paid: true,  due_days_offset: -5 },
  ],
};
