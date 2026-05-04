/**
 * Tekstil & Konfeksiyon sektörü demo dataset.
 *
 * 5 bayi (1 KRİTİK), 5 kategori, 20 ürün, 7 sipariş, 3 vade hareketi.
 */

import type { SectorDataset } from "./types";

const CATEGORIES = [
  "Pamuklu Kumaşlar",
  "Polyester & Karışım",
  "Aksesuar",
  "Dikiş Malzeme",
  "Astar",
];

export const tekstilDataset: SectorDataset = {
  slug: "tekstil",
  label: "Tekstil & Konfeksiyon",
  categories: CATEGORIES,

  products: [
    // Pamuklu Kumaşlar (4)
    { name: "Pamuklu Beyaz Top Kumaş 50m", code: "PAM-BYZ-TOP-50", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1850, stock_quantity: 30, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Penye Pamuk Lacivert 30m", code: "PAM-PEN-LAC-30", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1280, stock_quantity: 24, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Empirme Çiçekli Pamuk 25m", code: "PAM-EMP-CIC-25", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 980, stock_quantity: 18, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Pamuk Twill Bej 40m", code: "PAM-TWL-BEJ-40", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1420, stock_quantity: 22, brand: "Bursa Tekstil", vat_rate: 18, ean: null },

    // Polyester & Karışım (4)
    { name: "Polyester Karışım Siyah 30m", code: "POL-SYH-30", category: "Polyester & Karışım", unit: "top", unit_price: 850, stock_quantity: 36, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Polyester Mat Beyaz 50m", code: "POL-MAT-BYZ-50", category: "Polyester & Karışım", unit: "top", unit_price: 1120, stock_quantity: 28, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Polar Kumaş Gri 25m", code: "POL-PLR-GRI-25", category: "Polyester & Karışım", unit: "top", unit_price: 720, stock_quantity: 32, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Vual Beyaz Şal 40m", code: "POL-VUL-BYZ-40", category: "Polyester & Karışım", unit: "top", unit_price: 580, stock_quantity: 25, brand: "Anatolia", vat_rate: 18, ean: null },

    // Aksesuar (4)
    { name: "Fermuar 18cm Plastik 100'lü", code: "AKS-FRM-18-100", category: "Aksesuar", unit: "paket", unit_price: 145, stock_quantity: 240, brand: "YKK", vat_rate: 18, ean: null },
    { name: "Düğme 14mm Beyaz 200'lü", code: "AKS-DUG-14-200", category: "Aksesuar", unit: "paket", unit_price: 65, stock_quantity: 380, brand: "Esin", vat_rate: 18, ean: null },
    { name: "Cırt Bant 25mm × 25m", code: "AKS-CRT-25-25", category: "Aksesuar", unit: "rulo", unit_price: 85, stock_quantity: 180, brand: "Velcro", vat_rate: 18, ean: null },
    { name: "Lastik Bant 30mm × 50m", code: "AKS-LST-30-50", category: "Aksesuar", unit: "rulo", unit_price: 110, stock_quantity: 140, brand: "Esin", vat_rate: 18, ean: null },

    // Dikiş Malzeme (4)
    { name: "Pamuk İplik Beyaz 5000m Bobin", code: "DIK-IPL-BYZ-50", category: "Dikiş Malzeme", unit: "bobin", unit_price: 95, stock_quantity: 280, brand: "Sümerbank", vat_rate: 18, ean: null },
    { name: "Polyester İplik Lacivert 5000m", code: "DIK-POL-LAC-50", category: "Dikiş Malzeme", unit: "bobin", unit_price: 78, stock_quantity: 320, brand: "Sümerbank", vat_rate: 18, ean: null },
    { name: "Dikiş İğnesi Universal 90/14 100'lü", code: "DIK-IGN-90-100", category: "Dikiş Malzeme", unit: "paket", unit_price: 45, stock_quantity: 240, brand: "Schmetz", vat_rate: 18, ean: null },
    { name: "Çatal İğne Karışık 50'li", code: "DIK-CTL-IGN-50", category: "Dikiş Malzeme", unit: "paket", unit_price: 32, stock_quantity: 320, brand: "Schmetz", vat_rate: 18, ean: null },

    // Astar (4)
    { name: "Polyester Astar Bej 30m", code: "AST-POL-BEJ-30", category: "Astar", unit: "top", unit_price: 380, stock_quantity: 60, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Saten Astar Siyah 25m", code: "AST-SAT-SYH-25", category: "Astar", unit: "top", unit_price: 520, stock_quantity: 40, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Tela Yapışkanlı Beyaz 50m", code: "AST-TEL-BYZ-50", category: "Astar", unit: "top", unit_price: 245, stock_quantity: 80, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Vatka Yastık Dolgu 1kg", code: "AST-VTK-1KG", category: "Astar", unit: "paket", unit_price: 65, stock_quantity: 180, brand: "Esin", vat_rate: 18, ean: null },
  ],

  dealers: [
    {
      name: "Tekstil Sarayı", city: "Bursa", district: "İnegöl", country: "TR",
      contact_name: "Hüseyin Saray", contact_phone: "905321140001", email: "info@tekstilsarayi.com",
      address_line: "Cumhuriyet Mah. 15. Cad. 47", is_active: true, balance: 4500,
      tax_number: "4234567890", tax_office: "İnegöl Vergi Dairesi",
      iban: "TR320004600118444455566677", credit_limit: 18000, payment_term_days: 60,
      discount_rate: 11, risk_status: "clean", tags: ["VIP"],
      status_note: "Düzenli, orta hacim",
    },
    {
      name: "Asya Tekstil", city: "İstanbul", district: "Bayrampaşa", country: "TR",
      contact_name: "Aysun Demirbaş", contact_phone: "905321140002", email: "aysun@asyatekstil.com",
      address_line: "Topkapı Cad. 178", is_active: true, balance: 2800,
      tax_number: "4234567891", tax_office: "Bayrampaşa Vergi Dairesi",
      iban: "TR670012300066677788899900", credit_limit: 8000, payment_term_days: 45,
      discount_rate: 7, risk_status: "clean", tags: ["yeni"],
      status_note: "Yeni dönüşmüş, büyüyen cari",
    },
    {
      name: "Mehmet Kumaş", city: "Konya", district: "Meram", country: "TR",
      contact_name: "Mehmet Tan", contact_phone: "905321140003", email: "mehmet@mehmetkumas.com",
      address_line: "Yeni Yol Cad. 92", is_active: true, balance: 9800,
      tax_number: "4234567892", tax_office: "Meram Vergi Dairesi",
      iban: "TR140010009987651234567890", credit_limit: 10000, payment_term_days: 30,
      discount_rate: 5, risk_status: "watch", tags: ["kritik"],
      status_note: "KRİTİK — 15 gün geçmiş vade",
    },
    {
      name: "Yıldız Kumaş", city: "İzmir", district: "Konak", country: "TR",
      contact_name: "Fatma Yıldız", contact_phone: "905321140004", email: "fatma@yildizkumas.com",
      address_line: "Eşrefpaşa Cad. 35", is_active: true, balance: 1200,
      tax_number: "4234567893", tax_office: "Konak Vergi Dairesi",
      iban: "TR890006400000333344455566", credit_limit: 5000, payment_term_days: 30,
      discount_rate: 4, risk_status: "clean", tags: [],
      status_note: "Düzenli, küçük cari",
    },
    {
      name: "Anadolu Tekstil", city: "Gaziantep", district: "Şahinbey", country: "TR",
      contact_name: "Ahmet Doğan", contact_phone: "905321140005", email: "ahmet@anadolutekstil.com.tr",
      address_line: "İkinci Sanayi Sitesi 14. Cad. 5", is_active: true, balance: 5600,
      tax_number: "4234567894", tax_office: "Şahinbey Vergi Dairesi",
      iban: "TR450012300012345678987654", credit_limit: 22000, payment_term_days: 90,
      discount_rate: 13, risk_status: "clean", tags: ["VIP", "kurumsal"],
      status_note: "Toptan tekstilci",
    },
  ],

  orders: [
    { dealer_index: 0, product_index: 0,  quantity: 6,  status: "delivered",  days_ago: 14 },
    { dealer_index: 0, product_index: 8,  quantity: 12, status: "delivered",  days_ago: 6 },
    { dealer_index: 2, product_index: 4,  quantity: 8,  status: "delivered",  days_ago: 19 },
    { dealer_index: 4, product_index: 12, quantity: 15, status: "shipped",    days_ago: 3 },
    { dealer_index: 4, product_index: 1,  quantity: 4,  status: "preparing",  days_ago: 1 },
    { dealer_index: 1, product_index: 16, quantity: 8,  status: "preparing",  days_ago: 2 },
    { dealer_index: 3, product_index: 9,  quantity: 4,  status: "pending",    days_ago: 0 },
  ],

  invoices: [
    { dealer_index: 2, amount: 9800, is_paid: false, due_days_offset: -15 },
    { dealer_index: 0, amount: 4500, is_paid: false, due_days_offset: 7 },
    { dealer_index: 3, amount: 1200, is_paid: true,  due_days_offset: -6 },
  ],
};
