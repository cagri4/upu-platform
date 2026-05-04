/**
 * Boya & Yapı Kimyasalı sektörü demo dataset.
 *
 * 5 bayi (1 KRİTİK 12 gün geçmiş vade), 5 kategori, 20 ürün (4/kategori),
 * 7 sipariş (farklı durumlar), 3 vade hareketi (1 ödenmiş + 1 bekleyen +
 * 1 kritik geçmiş). Currency-agnostic — UI tenant_locale'e göre render.
 */

import type { SectorDataset } from "./types";

const CATEGORIES = [
  "İç Cephe Boyaları",
  "Dış Cephe Boyaları",
  "Vernikler & Cilalar",
  "Boyama Aletleri",
  "Yardımcı Malzemeler",
];

export const boyaDataset: SectorDataset = {
  slug: "boya",
  label: "Boya & Yapı Kimyasalı",
  categories: CATEGORIES,

  products: [
    // İç Cephe Boyaları (4)
    { name: "Filli Boya İç Cephe Mat 15L", code: "BOYA-FIL-IC-15L", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 850, stock_quantity: 60, brand: "Filli Boya", vat_rate: 20, ean: "8690999000101" },
    { name: "Marshall Plastik İç Cephe 3L", code: "BOYA-MAR-PLA-3L", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 220, stock_quantity: 120, brand: "Marshall", vat_rate: 20, ean: "8690999000102" },
    { name: "Polisan Saten İç Cephe 7.5L", code: "BOYA-POL-SAT-75", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 480, stock_quantity: 40, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Dyo İpek Mat İç Cephe 15L", code: "BOYA-DYO-IPK-15", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 920, stock_quantity: 35, brand: "Dyo", vat_rate: 20, ean: null },

    // Dış Cephe Boyaları (4)
    { name: "Filli Boya Dış Cephe Akrilik 15L", code: "BOYA-FIL-DIS-15", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1180, stock_quantity: 28, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Marshall Maxitherm Mantolama 25kg", code: "BOYA-MAR-MTRM-25", category: "Dış Cephe Boyaları", unit: "torba", unit_price: 380, stock_quantity: 80, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Polisan Silikonlu Dış Cephe 17.5L", code: "BOYA-POL-SIL-17", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1450, stock_quantity: 18, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Dyo Termoplus Dış Cephe 15L", code: "BOYA-DYO-TER-15", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1320, stock_quantity: 22, brand: "Dyo", vat_rate: 20, ean: null },

    // Vernikler & Cilalar (4)
    { name: "Polisan Vernik Şeffaf Parlak 2.5L", code: "VER-POL-SEF-25", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 285, stock_quantity: 90, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Marshall Yat Verniği 0.75L", code: "VER-MAR-YAT-075", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 145, stock_quantity: 110, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Filli Wood Cila Saten 2.5L", code: "VER-FIL-WOOD-25", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 320, stock_quantity: 55, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Dyo Mobilya Verniği 1L", code: "VER-DYO-MOB-1L", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 175, stock_quantity: 75, brand: "Dyo", vat_rate: 20, ean: null },

    // Boyama Aletleri (4)
    { name: "Bosch Boya Rulo Seti 25cm", code: "ALT-BSC-RUL-25", category: "Boyama Aletleri", unit: "set", unit_price: 95, stock_quantity: 200, brand: "Bosch", vat_rate: 20, ean: "3165140987601" },
    { name: "Stanley Boya Fırçası 4'lü Set", code: "ALT-STN-FRC-4L", category: "Boyama Aletleri", unit: "set", unit_price: 65, stock_quantity: 180, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Tamirini Boya Tepsisi Plastik", code: "ALT-TAM-TEP-PL", category: "Boyama Aletleri", unit: "adet", unit_price: 28, stock_quantity: 250, brand: "Tamirini", vat_rate: 20, ean: null },
    { name: "Bosch Airless Boya Tabancası 1500W", code: "ALT-BSC-AIRLES", category: "Boyama Aletleri", unit: "adet", unit_price: 4850, stock_quantity: 8, brand: "Bosch", vat_rate: 20, ean: null },

    // Yardımcı Malzemeler (4)
    { name: "Boya İnceltici 5L", code: "YRD-INC-5L", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 240, stock_quantity: 140, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Maskeleme Bandı 48mm × 25m", code: "YRD-BND-48-25", category: "Yardımcı Malzemeler", unit: "rulo", unit_price: 35, stock_quantity: 320, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Akrilik Macun 1kg", code: "YRD-MAC-1KG", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 85, stock_quantity: 160, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Astar Beyaz İç Cephe 10L", code: "YRD-AST-IC-10L", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 380, stock_quantity: 65, brand: "Dyo", vat_rate: 20, ean: null },
  ],

  dealers: [
    {
      name: "Kalfa Boya & Yapı",     city: "Pendik",  district: "Kaynarca", country: "TR",
      contact_name: "Mustafa Kalfa",  contact_phone: "905321110001", email: "info@kalfaboya.com.tr",
      address_line: "Atatürk Cad. No:142", is_active: true, balance: 2400,
      tax_number: "1234567890", tax_office: "Pendik Vergi Dairesi",
      iban: "TR320010009999987654321001", credit_limit: 15000, payment_term_days: 60,
      discount_rate: 10, risk_status: "clean", tags: ["VIP"],
      status_note: "Düzenli alım, normal cari",
    },
    {
      name: "Hasan Hırdavat",        city: "Çankaya", district: "Bahçelievler", country: "TR",
      contact_name: "Hasan Yıldırım", contact_phone: "905321110002", email: "hasan@hasanhirdavat.com",
      address_line: "Şehit Cengiz Topel Sok. 8/A", is_active: true, balance: 0,
      tax_number: "1234567891", tax_office: "Çankaya Vergi Dairesi",
      iban: "", credit_limit: 5000, payment_term_days: 30, discount_rate: 0,
      risk_status: "clean", tags: ["yeni"],
      status_note: "Yeni kayıt, ilk siparişi bekleniyor",
    },
    {
      name: "Demir Ticaret",         city: "Bursa",   district: "Osmangazi", country: "TR",
      contact_name: "Ahmet Demir",    contact_phone: "905321110003", email: "ahmet@demirticaret.com.tr",
      address_line: "İnönü Cad. Demir Apt. No:24", is_active: true, balance: 8500,
      tax_number: "1234567892", tax_office: "Osmangazi Vergi Dairesi",
      iban: "TR450004600118888888888801", credit_limit: 10000, payment_term_days: 30,
      discount_rate: 5, risk_status: "watch", tags: ["kritik"],
      status_note: "KRİTİK — 12 gün geçmiş vade",
    },
    {
      name: "Ayşe Yapı Market",      city: "İzmir",   district: "Karşıyaka", country: "TR",
      contact_name: "Ayşe Çelik",     contact_phone: "905321110004", email: "ayse@ayseyapi.com",
      address_line: "Mavişehir Bulvarı 12", is_active: true, balance: 850,
      tax_number: "1234567893", tax_office: "Karşıyaka Vergi Dairesi",
      iban: "TR670006400000123456789012", credit_limit: 8000, payment_term_days: 45,
      discount_rate: 8, risk_status: "clean", tags: [],
      status_note: "Küçük cari, düzenli ödeyici",
    },
    {
      name: "Yılmaz Boya Toptan",    city: "Konya",   district: "Selçuklu", country: "TR",
      contact_name: "Veli Yılmaz",    contact_phone: "905321110005", email: "veli@yilmazboya.com",
      address_line: "Yeni İstanbul Cad. 88", is_active: true, balance: 4200,
      tax_number: "1234567894", tax_office: "Selçuklu Vergi Dairesi",
      iban: "TR140012300055544411122233", credit_limit: 20000, payment_term_days: 90,
      discount_rate: 12, risk_status: "clean", tags: ["VIP", "kurumsal"],
      status_note: "Büyük hacimli toptan",
    },
  ],

  orders: [
    { dealer_index: 0, product_index: 0,  quantity: 4,  status: "delivered",  days_ago: 12 },
    { dealer_index: 0, product_index: 12, quantity: 6,  status: "delivered",  days_ago: 6 },
    { dealer_index: 2, product_index: 4,  quantity: 8,  status: "delivered",  days_ago: 18 },
    { dealer_index: 4, product_index: 8,  quantity: 20, status: "shipped",    days_ago: 3 },
    { dealer_index: 4, product_index: 1,  quantity: 30, status: "preparing",  days_ago: 1 },
    { dealer_index: 3, product_index: 16, quantity: 12, status: "preparing",  days_ago: 2 },
    { dealer_index: 1, product_index: 13, quantity: 4,  status: "pending",    days_ago: 0 },
  ],

  invoices: [
    { dealer_index: 2, amount: 8500, is_paid: false, due_days_offset: -12 },
    { dealer_index: 0, amount: 2400, is_paid: false, due_days_offset: 4 },
    { dealer_index: 3, amount: 850,  is_paid: true,  due_days_offset: -8 },
  ],
};
