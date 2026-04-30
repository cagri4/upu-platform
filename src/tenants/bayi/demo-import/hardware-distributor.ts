/**
 * Demo Data Import — Hırdavat / İnşaat Dağıtıcı (Hollanda)
 *
 * Endüstriyel ürün dağıtıcısı senaryosu için mock dataset:
 *   - 25 ürün (vida/cıvata/yapıştırıcı/elektrik/boya kategorileri)
 *   - 12 bayi (NL + BE inşaat sitelerinden — Türk işyerleri ağırlıklı)
 *   - 8 sipariş (geçmiş 30 gün, 3'ü teslim, 3'ü hazırlanıyor, 2'si onay bekliyor)
 *   - 4 fatura (1'i ödenmiş, 2'si vade gelmiş, 1'i vadesi geçmiş)
 *
 * Kullanım: ilk müşteri demo'sunda /api/bayi-demo/import endpoint'i
 * çağrılır → owner'ın tenant_id'sine bu dataset yazılır → sahip WA'ya
 * yazdığında "vay, benim bayilerimi tanıyor" mucize moment yaşanır.
 *
 * Production'da kullanmamak için: endpoint owner-only + onaylı email
 * domain check. Demo veriyi temizlemek için /api/bayi-demo/clear.
 */

export interface DemoProduct {
  name: string;
  code: string;
  category: string;
  unit: string;
  unit_price: number;
  stock_quantity: number;
  brand: string;
  vat_rate: number;
  ean: string | null;
}

export interface DemoDealer {
  name: string;
  city: string;
  country: string;
  contact_name: string;
  contact_phone: string;
  is_active: boolean;
  balance: number;             // pozitif = bayi borçlu
}

export interface DemoOrder {
  dealer_index: number;        // DEMO_DEALERS array index
  product_index: number;       // DEMO_PRODUCTS array index
  quantity: number;
  status: "pending" | "preparing" | "shipped" | "delivered";
  days_ago: number;            // created_at hesaplaması için
}

export interface DemoInvoice {
  dealer_index: number;
  amount: number;
  is_paid: boolean;
  due_days_offset: number;     // negatif = vade geçmiş, pozitif = ileride
}

// ── Ürünler ─────────────────────────────────────────────────────────────

export const DEMO_PRODUCTS: DemoProduct[] = [
  // Vida / Cıvata
  { name: "M8 × 40 Galvaniz Vida (250 lik)", code: "VID-M8-40", category: "Vida & Cıvata", unit: "paket", unit_price: 24.50, stock_quantity: 80, brand: "Bossard", vat_rate: 21, ean: "8714123456001" },
  { name: "M10 × 60 Inox Vida (100 lik)", code: "VID-M10-60-INOX", category: "Vida & Cıvata", unit: "paket", unit_price: 38.00, stock_quantity: 120, brand: "Bossard", vat_rate: 21, ean: "8714123456002" },
  { name: "Beton Dübel 6×40 (200 lik)", code: "DUBEL-6-40", category: "Vida & Cıvata", unit: "paket", unit_price: 16.75, stock_quantity: 200, brand: "Fischer", vat_rate: 21, ean: "8714123456003" },
  { name: "Çatı Vidası 6.3×100 (50 lik)", code: "VID-CATI-100", category: "Vida & Cıvata", unit: "paket", unit_price: 22.40, stock_quantity: 90, brand: "Spax", vat_rate: 21, ean: null },

  // Boya
  { name: "Akzo Beyaz İç Cephe Mat 15L", code: "BOYA-AKZO-IC-15L", category: "Boya & Vernik", unit: "kutu", unit_price: 89.90, stock_quantity: 45, brand: "Akzo Nobel", vat_rate: 21, ean: "8714987654001" },
  { name: "Akzo Yağlı Boya Beyaz 5L", code: "BOYA-AKZO-YAG-5L", category: "Boya & Vernik", unit: "kutu", unit_price: 64.50, stock_quantity: 30, brand: "Akzo Nobel", vat_rate: 21, ean: "8714987654002" },
  { name: "Tikkurila Dış Cephe Astar 10L", code: "BOYA-TIK-DIS-10L", category: "Boya & Vernik", unit: "kutu", unit_price: 72.00, stock_quantity: 22, brand: "Tikkurila", vat_rate: 21, ean: null },
  { name: "Bayer Vernik Şeffaf 2.5L", code: "VER-BAYER-25L", category: "Boya & Vernik", unit: "kutu", unit_price: 31.50, stock_quantity: 60, brand: "Bayer", vat_rate: 21, ean: null },

  // Yapıştırıcı / Macun
  { name: "Sika Polimerik Yapıştırıcı 290ml", code: "YAP-SIKA-290", category: "Yapıştırıcı", unit: "adet", unit_price: 8.75, stock_quantity: 250, brand: "Sika", vat_rate: 21, ean: "7610256789001" },
  { name: "Pattex Hızlı Tutkal 50g", code: "TUT-PATTEX-50", category: "Yapıştırıcı", unit: "adet", unit_price: 5.20, stock_quantity: 180, brand: "Pattex", vat_rate: 21, ean: null },
  { name: "Akrilik Mastik Beyaz 310ml", code: "MAS-AKRILIK-310", category: "Yapıştırıcı", unit: "adet", unit_price: 4.95, stock_quantity: 320, brand: "Soudal", vat_rate: 21, ean: null },

  // Elektrik
  { name: "NYM 3×2.5 Kablo (100m)", code: "KABLO-NYM-3X25", category: "Elektrik", unit: "rulo", unit_price: 145.00, stock_quantity: 18, brand: "Prysmian", vat_rate: 21, ean: null },
  { name: "Schuko Topraklı Priz Beyaz", code: "PRIZ-SCHUKO-BYZ", category: "Elektrik", unit: "adet", unit_price: 6.40, stock_quantity: 200, brand: "Niko", vat_rate: 21, ean: null },
  { name: "Anahtar Tek Kontrol Beyaz", code: "ANH-TEK-BYZ", category: "Elektrik", unit: "adet", unit_price: 4.85, stock_quantity: 220, brand: "Niko", vat_rate: 21, ean: null },
  { name: "LED Spot 7W Sıcak Beyaz", code: "LED-SPOT-7W-SB", category: "Elektrik", unit: "adet", unit_price: 8.90, stock_quantity: 350, brand: "Philips", vat_rate: 21, ean: null },

  // Tesisat / Sıhhi
  { name: "PPR Boru 25mm (4m)", code: "PPR-25-4M", category: "Tesisat", unit: "adet", unit_price: 12.30, stock_quantity: 75, brand: "Wavin", vat_rate: 21, ean: null },
  { name: "Lavabo Bataryası Krom", code: "BAT-LAV-KRM", category: "Tesisat", unit: "adet", unit_price: 58.90, stock_quantity: 25, brand: "Grohe", vat_rate: 21, ean: null },
  { name: "Tuvalet Sifonu Komple", code: "SIFON-TUV-KMP", category: "Tesisat", unit: "adet", unit_price: 34.50, stock_quantity: 40, brand: "Geberit", vat_rate: 21, ean: null },

  // İzolasyon
  { name: "EPS 50mm İzolasyon Plakası", code: "EPS-50MM", category: "İzolasyon", unit: "m2", unit_price: 7.20, stock_quantity: 480, brand: "Knauf", vat_rate: 21, ean: null },
  { name: "Cam Yünü 100mm (5m²)", code: "CAM-YUN-100", category: "İzolasyon", unit: "rulo", unit_price: 28.40, stock_quantity: 65, brand: "Isover", vat_rate: 21, ean: null },

  // Aletler
  { name: "Bosch Akülü Vidalama 18V", code: "BOSCH-VID-18V", category: "Aletler", unit: "adet", unit_price: 189.00, stock_quantity: 12, brand: "Bosch", vat_rate: 21, ean: "3165140123456" },
  { name: "Stanley Çekiç 500g", code: "CEKIC-STAN-500", category: "Aletler", unit: "adet", unit_price: 18.50, stock_quantity: 60, brand: "Stanley", vat_rate: 21, ean: null },
  { name: "Maket Bıçağı 18mm", code: "BIC-MAK-18", category: "Aletler", unit: "adet", unit_price: 3.40, stock_quantity: 200, brand: "Stanley", vat_rate: 21, ean: null },

  // İş Güvenliği
  { name: "İş Eldiveni (Çift)", code: "ELD-IS-CFT", category: "İş Güvenliği", unit: "çift", unit_price: 2.85, stock_quantity: 500, brand: "3M", vat_rate: 21, ean: null },
  { name: "Toz Maskesi FFP2 (10 lu)", code: "MAS-FFP2-10", category: "İş Güvenliği", unit: "paket", unit_price: 14.90, stock_quantity: 80, brand: "3M", vat_rate: 21, ean: null },
];

// ── Bayiler (Türk diaspora ağırlıklı, NL + BE inşaat siteleri) ─────────

export const DEMO_DEALERS: DemoDealer[] = [
  { name: "Demir Yapı Market",       city: "Rotterdam",  country: "NL", contact_name: "Mehmet Demir",   contact_phone: "31612345671", is_active: true, balance: 4300 },
  { name: "Yıldız İnşaat Toptan",    city: "Amsterdam",  country: "NL", contact_name: "Ayşe Yıldız",    contact_phone: "31612345672", is_active: true, balance: 1850 },
  { name: "Bursa Hırdavat",          city: "Eindhoven",  country: "NL", contact_name: "Hasan Kaya",     contact_phone: "31612345673", is_active: true, balance: 6200 },
  { name: "Anadolu Yapı Malzemesi",  city: "Den Haag",   country: "NL", contact_name: "Selim Arslan",   contact_phone: "31612345674", is_active: true, balance: 0 },
  { name: "Hilal İnşaat",            city: "Utrecht",    country: "NL", contact_name: "Fatma Öztürk",   contact_phone: "31612345675", is_active: true, balance: 920 },
  { name: "Kara Boya & Vernik",      city: "Tilburg",    country: "NL", contact_name: "Ali Karaca",     contact_phone: "31612345676", is_active: true, balance: 2750 },
  { name: "Anatolia Bouw Supplies",  city: "Antwerpen",  country: "BE", contact_name: "Zeynep Aydın",   contact_phone: "32412345677", is_active: true, balance: 3100 },
  { name: "Ege Tesisat Malzeme",     city: "Almere",     country: "NL", contact_name: "İbrahim Şahin",  contact_phone: "31612345678", is_active: true, balance: 1450 },
  { name: "Marmara Elektrik",        city: "Groningen",  country: "NL", contact_name: "Mustafa Çelik",  contact_phone: "31612345679", is_active: true, balance: 0 },
  { name: "Akdeniz Yapı Marketi",    city: "Brussel",    country: "BE", contact_name: "Cenk Yılmaz",    contact_phone: "32412345670", is_active: true, balance: 5400 },
  { name: "Karadeniz Hırdavat",      city: "Nijmegen",   country: "NL", contact_name: "Hatice Polat",   contact_phone: "31612345681", is_active: false, balance: 0 },
  { name: "Toros Boya Toptan",       city: "Breda",      country: "NL", contact_name: "Veli Dursun",    contact_phone: "31612345682", is_active: true, balance: 780 },
];

// ── Siparişler (geçmiş 30 gün) ──────────────────────────────────────────

export const DEMO_ORDERS: DemoOrder[] = [
  { dealer_index: 0,  product_index: 4,  quantity: 5,   status: "delivered",  days_ago: 14 },
  { dealer_index: 0,  product_index: 8,  quantity: 24,  status: "delivered",  days_ago: 9 },
  { dealer_index: 1,  product_index: 0,  quantity: 12,  status: "shipped",    days_ago: 4 },
  { dealer_index: 2,  product_index: 5,  quantity: 8,   status: "delivered",  days_ago: 18 },
  { dealer_index: 5,  product_index: 4,  quantity: 15,  status: "preparing",  days_ago: 2 },
  { dealer_index: 6,  product_index: 11, quantity: 4,   status: "preparing",  days_ago: 1 },
  { dealer_index: 7,  product_index: 15, quantity: 20,  status: "pending",    days_ago: 0 },
  { dealer_index: 9,  product_index: 4,  quantity: 25,  status: "shipped",    days_ago: 6 },
];

// ── Faturalar (vade haritası) ───────────────────────────────────────────

export const DEMO_INVOICES: DemoInvoice[] = [
  { dealer_index: 0, amount: 4300, is_paid: false, due_days_offset: -3 },   // Demir Yapı: 3 gün gecikti
  { dealer_index: 1, amount: 1850, is_paid: false, due_days_offset: 5 },    // Yıldız: vade 5 gün sonra
  { dealer_index: 2, amount: 6200, is_paid: false, due_days_offset: -12 },  // Bursa Hırdavat: 12 gün gecikti
  { dealer_index: 4, amount: 920,  is_paid: true,  due_days_offset: -7 },   // Hilal: ödendi
];
