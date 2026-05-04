/**
 * Sektör bazlı demo dataset (CLI seed script için JS mirror).
 *
 * src/tenants/bayi/demo-import/sectors/*.ts ile içerik olarak senkron;
 * .mjs versiyonu Node.js'de doğrudan import edilebilsin diye ayrı tutuluyor.
 * Eğer .ts datasetleri güncellenirse buradakini de güncelle.
 *
 * 5 sektör × (5 bayi + 5 kategori + 20 ürün + 7 sipariş + 3 vade hareketi).
 */

// ── Boya & Yapı Kimyasalı ───────────────────────────────────────────
const boya = {
  slug: "boya",
  label: "Boya & Yapı Kimyasalı",
  categories: ["İç Cephe Boyaları","Dış Cephe Boyaları","Vernikler & Cilalar","Boyama Aletleri","Yardımcı Malzemeler"],
  products: [
    { name: "Filli Boya İç Cephe Mat 15L", code: "BOYA-FIL-IC-15L", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 850, stock_quantity: 60, brand: "Filli Boya", vat_rate: 20, ean: "8690999000101" },
    { name: "Marshall Plastik İç Cephe 3L", code: "BOYA-MAR-PLA-3L", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 220, stock_quantity: 120, brand: "Marshall", vat_rate: 20, ean: "8690999000102" },
    { name: "Polisan Saten İç Cephe 7.5L", code: "BOYA-POL-SAT-75", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 480, stock_quantity: 40, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Dyo İpek Mat İç Cephe 15L", code: "BOYA-DYO-IPK-15", category: "İç Cephe Boyaları", unit: "kutu", unit_price: 920, stock_quantity: 35, brand: "Dyo", vat_rate: 20, ean: null },
    { name: "Filli Boya Dış Cephe Akrilik 15L", code: "BOYA-FIL-DIS-15", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1180, stock_quantity: 28, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Marshall Maxitherm Mantolama 25kg", code: "BOYA-MAR-MTRM-25", category: "Dış Cephe Boyaları", unit: "torba", unit_price: 380, stock_quantity: 80, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Polisan Silikonlu Dış Cephe 17.5L", code: "BOYA-POL-SIL-17", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1450, stock_quantity: 18, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Dyo Termoplus Dış Cephe 15L", code: "BOYA-DYO-TER-15", category: "Dış Cephe Boyaları", unit: "kutu", unit_price: 1320, stock_quantity: 22, brand: "Dyo", vat_rate: 20, ean: null },
    { name: "Polisan Vernik Şeffaf Parlak 2.5L", code: "VER-POL-SEF-25", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 285, stock_quantity: 90, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Marshall Yat Verniği 0.75L", code: "VER-MAR-YAT-075", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 145, stock_quantity: 110, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Filli Wood Cila Saten 2.5L", code: "VER-FIL-WOOD-25", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 320, stock_quantity: 55, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Dyo Mobilya Verniği 1L", code: "VER-DYO-MOB-1L", category: "Vernikler & Cilalar", unit: "kutu", unit_price: 175, stock_quantity: 75, brand: "Dyo", vat_rate: 20, ean: null },
    { name: "Bosch Boya Rulo Seti 25cm", code: "ALT-BSC-RUL-25", category: "Boyama Aletleri", unit: "set", unit_price: 95, stock_quantity: 200, brand: "Bosch", vat_rate: 20, ean: "3165140987601" },
    { name: "Stanley Boya Fırçası 4'lü Set", code: "ALT-STN-FRC-4L", category: "Boyama Aletleri", unit: "set", unit_price: 65, stock_quantity: 180, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Tamirini Boya Tepsisi Plastik", code: "ALT-TAM-TEP-PL", category: "Boyama Aletleri", unit: "adet", unit_price: 28, stock_quantity: 250, brand: "Tamirini", vat_rate: 20, ean: null },
    { name: "Bosch Airless Boya Tabancası 1500W", code: "ALT-BSC-AIRLES", category: "Boyama Aletleri", unit: "adet", unit_price: 4850, stock_quantity: 8, brand: "Bosch", vat_rate: 20, ean: null },
    { name: "Boya İnceltici 5L", code: "YRD-INC-5L", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 240, stock_quantity: 140, brand: "Polisan", vat_rate: 20, ean: null },
    { name: "Maskeleme Bandı 48mm × 25m", code: "YRD-BND-48-25", category: "Yardımcı Malzemeler", unit: "rulo", unit_price: 35, stock_quantity: 320, brand: "Marshall", vat_rate: 20, ean: null },
    { name: "Akrilik Macun 1kg", code: "YRD-MAC-1KG", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 85, stock_quantity: 160, brand: "Filli Boya", vat_rate: 20, ean: null },
    { name: "Astar Beyaz İç Cephe 10L", code: "YRD-AST-IC-10L", category: "Yardımcı Malzemeler", unit: "kutu", unit_price: 380, stock_quantity: 65, brand: "Dyo", vat_rate: 20, ean: null },
  ],
  dealers: [
    { name: "Kalfa Boya & Yapı",  city: "Pendik",  country: "TR", contact_name: "Mustafa Kalfa",  contact_phone: "905321110001", is_active: true, balance: 2400 },
    { name: "Hasan Hırdavat",     city: "Çankaya", country: "TR", contact_name: "Hasan Yıldırım", contact_phone: "905321110002", is_active: true, balance: 0 },
    { name: "Demir Ticaret",      city: "Bursa",   country: "TR", contact_name: "Ahmet Demir",    contact_phone: "905321110003", is_active: true, balance: 8500 },
    { name: "Ayşe Yapı Market",   city: "İzmir",   country: "TR", contact_name: "Ayşe Çelik",     contact_phone: "905321110004", is_active: true, balance: 850 },
    { name: "Yılmaz Boya Toptan", city: "Konya",   country: "TR", contact_name: "Veli Yılmaz",    contact_phone: "905321110005", is_active: true, balance: 4200 },
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

// ── Gıda & Bakliyat ─────────────────────────────────────────────────
const gida = {
  slug: "gida",
  label: "Gıda & Bakliyat",
  categories: ["Bakliyat","Un & Bulgur","Pirinç & Makarna","Yağ & Sıvılar","Salça & Konserve"],
  products: [
    { name: "Reis Yeşil Mercimek 5kg", code: "BAK-REIS-MER-5", category: "Bakliyat", unit: "torba", unit_price: 285, stock_quantity: 180, brand: "Reis", vat_rate: 1, ean: "8690999100101" },
    { name: "Yayla Nohut 5kg", code: "BAK-YAY-NOH-5", category: "Bakliyat", unit: "torba", unit_price: 320, stock_quantity: 220, brand: "Yayla", vat_rate: 1, ean: "8690999100102" },
    { name: "Reis Kuru Fasulye 5kg", code: "BAK-REIS-FAS-5", category: "Bakliyat", unit: "torba", unit_price: 410, stock_quantity: 140, brand: "Reis", vat_rate: 1, ean: "8690999100103" },
    { name: "Yayla Kırmızı Mercimek 5kg", code: "BAK-YAY-KIR-5", category: "Bakliyat", unit: "torba", unit_price: 295, stock_quantity: 200, brand: "Yayla", vat_rate: 1, ean: null },
    { name: "Söke Buğday Unu 5kg", code: "UNB-SOK-UN-5", category: "Un & Bulgur", unit: "torba", unit_price: 185, stock_quantity: 240, brand: "Söke", vat_rate: 1, ean: "8690999100201" },
    { name: "Yayla Köftelik Bulgur 5kg", code: "UNB-YAY-KOF-5", category: "Un & Bulgur", unit: "torba", unit_price: 215, stock_quantity: 160, brand: "Yayla", vat_rate: 1, ean: null },
    { name: "Reis Pilavlık Bulgur 5kg", code: "UNB-REIS-PIL-5", category: "Un & Bulgur", unit: "torba", unit_price: 220, stock_quantity: 140, brand: "Reis", vat_rate: 1, ean: null },
    { name: "Söke Tam Buğday Unu 5kg", code: "UNB-SOK-TAM-5", category: "Un & Bulgur", unit: "torba", unit_price: 210, stock_quantity: 90, brand: "Söke", vat_rate: 1, ean: null },
    { name: "Reis Baldo Pirinç 5kg", code: "PRC-REIS-BLD-5", category: "Pirinç & Makarna", unit: "torba", unit_price: 480, stock_quantity: 200, brand: "Reis", vat_rate: 1, ean: "8690999100301" },
    { name: "Reis Osmancık Pirinç 5kg", code: "PRC-REIS-OSM-5", category: "Pirinç & Makarna", unit: "torba", unit_price: 420, stock_quantity: 180, brand: "Reis", vat_rate: 1, ean: null },
    { name: "Filiz Spagetti 1kg", code: "PRC-FIL-SPG-1", category: "Pirinç & Makarna", unit: "paket", unit_price: 38, stock_quantity: 600, brand: "Filiz", vat_rate: 1, ean: null },
    { name: "Barilla Penne 500g", code: "PRC-BAR-PNE-5", category: "Pirinç & Makarna", unit: "paket", unit_price: 52, stock_quantity: 480, brand: "Barilla", vat_rate: 1, ean: null },
    { name: "Komili Zeytinyağı 5L Teneke", code: "YAG-KOM-ZEY-5", category: "Yağ & Sıvılar", unit: "teneke", unit_price: 1850, stock_quantity: 60, brand: "Komili", vat_rate: 8, ean: "8690999100401" },
    { name: "Yudum Ayçiçek Yağı 5L", code: "YAG-YUD-AYC-5", category: "Yağ & Sıvılar", unit: "teneke", unit_price: 720, stock_quantity: 90, brand: "Yudum", vat_rate: 8, ean: null },
    { name: "Komili Riviera Zeytinyağı 1L", code: "YAG-KOM-RIV-1", category: "Yağ & Sıvılar", unit: "şişe", unit_price: 380, stock_quantity: 150, brand: "Komili", vat_rate: 8, ean: null },
    { name: "Sırma Doğal Su 1.5L (6'lı)", code: "YAG-SRM-SU-15", category: "Yağ & Sıvılar", unit: "koli", unit_price: 65, stock_quantity: 280, brand: "Sırma", vat_rate: 1, ean: null },
    { name: "Tat Domates Salçası 4kg Teneke", code: "SAL-TAT-DOM-4", category: "Salça & Konserve", unit: "teneke", unit_price: 320, stock_quantity: 100, brand: "Tat", vat_rate: 8, ean: "8690999100501" },
    { name: "Tat Biber Salçası 700g", code: "SAL-TAT-BIB-7", category: "Salça & Konserve", unit: "kavanoz", unit_price: 78, stock_quantity: 240, brand: "Tat", vat_rate: 8, ean: null },
    { name: "Tukaş Konserve Bezelye 800g", code: "SAL-TUK-BEZ-8", category: "Salça & Konserve", unit: "kutu", unit_price: 45, stock_quantity: 360, brand: "Tukaş", vat_rate: 8, ean: null },
    { name: "Penguen Domates Püresi 700g", code: "SAL-PEN-DPR-7", category: "Salça & Konserve", unit: "kavanoz", unit_price: 52, stock_quantity: 200, brand: "Penguen", vat_rate: 8, ean: null },
  ],
  dealers: [
    { name: "Anadolu Gıda Toptan", city: "Adana",    country: "TR", contact_name: "Mehmet Akın",    contact_phone: "905321120001", is_active: true, balance: 3200 },
    { name: "Mehmet Bakkal",       city: "Konya",    country: "TR", contact_name: "Mehmet Tezcan",  contact_phone: "905321120002", is_active: true, balance: 480 },
    { name: "Ege Toptan Gıda",     city: "İzmir",    country: "TR", contact_name: "Hasan Yenice",   contact_phone: "905321120003", is_active: true, balance: 9200 },
    { name: "Yılmaz Gıda",         city: "Bursa",    country: "TR", contact_name: "Veli Yılmaz",    contact_phone: "905321120004", is_active: true, balance: 1850 },
    { name: "Aysu Market Zinciri", city: "İstanbul", country: "TR", contact_name: "Aysu Demirtaş",  contact_phone: "905321120005", is_active: true, balance: 5400 },
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

// ── Hırdavat & İnşaat ───────────────────────────────────────────────
const hirdavat = {
  slug: "hirdavat",
  label: "Hırdavat & İnşaat",
  categories: ["El Aletleri","Vida & Bağlantı","Sarf Malzeme","Boya Aletleri","Güvenlik"],
  products: [
    { name: "Bosch GBM 18V-21 Akülü Matkap", code: "ALT-BSC-MAT-18", category: "El Aletleri", unit: "adet", unit_price: 4250, stock_quantity: 24, brand: "Bosch", vat_rate: 20, ean: "3165140987001" },
    { name: "Stanley Çekiç 500g Çelik Saplı", code: "ALT-STN-CKC-500", category: "El Aletleri", unit: "adet", unit_price: 185, stock_quantity: 80, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Makita Avuç Taşlama 850W", code: "ALT-MAK-AVUC-85", category: "El Aletleri", unit: "adet", unit_price: 1850, stock_quantity: 18, brand: "Makita", vat_rate: 20, ean: null },
    { name: "Bosch Lazer Hizalama Cihazı", code: "ALT-BSC-LZR-HIZ", category: "El Aletleri", unit: "adet", unit_price: 980, stock_quantity: 12, brand: "Bosch", vat_rate: 20, ean: null },
    { name: "Vida 5×60mm 100'lü Paket", code: "VID-5-60-100", category: "Vida & Bağlantı", unit: "paket", unit_price: 75, stock_quantity: 320, brand: "Bossard", vat_rate: 20, ean: null },
    { name: "Plastik Dübel 6mm 100'lü", code: "VID-DBL-6-100", category: "Vida & Bağlantı", unit: "paket", unit_price: 38, stock_quantity: 480, brand: "Fischer", vat_rate: 20, ean: null },
    { name: "M8 × 40 Galvaniz Cıvata 250'li", code: "VID-M8-40-250", category: "Vida & Bağlantı", unit: "paket", unit_price: 145, stock_quantity: 180, brand: "Bossard", vat_rate: 20, ean: null },
    { name: "Çatı Vidası 6.3 × 100mm 50'li", code: "VID-CAT-100-50", category: "Vida & Bağlantı", unit: "paket", unit_price: 98, stock_quantity: 140, brand: "Spax", vat_rate: 20, ean: null },
    { name: "Akrilik Mastik Beyaz 310ml", code: "SRF-MST-AKR-31", category: "Sarf Malzeme", unit: "tüp", unit_price: 32, stock_quantity: 380, brand: "Soudal", vat_rate: 20, ean: null },
    { name: "Sika Polimer Yapıştırıcı 290ml", code: "SRF-SIK-POL-29", category: "Sarf Malzeme", unit: "tüp", unit_price: 65, stock_quantity: 240, brand: "Sika", vat_rate: 20, ean: null },
    { name: "Maket Bıçağı 18mm 10'lu", code: "SRF-MKT-BIC-18", category: "Sarf Malzeme", unit: "paket", unit_price: 28, stock_quantity: 520, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Bant Gri Tamir 48mm × 25m", code: "SRF-BNT-GRI-48", category: "Sarf Malzeme", unit: "rulo", unit_price: 42, stock_quantity: 280, brand: "3M", vat_rate: 20, ean: null },
    { name: "Boya Rulo 25cm Kısa Tüy", code: "BOY-RUL-25-KSA", category: "Boya Aletleri", unit: "adet", unit_price: 22, stock_quantity: 420, brand: "Bosch", vat_rate: 20, ean: null },
    { name: "Boya Fırçası 4'lü Set Çeşitli", code: "BOY-FRC-4-SET", category: "Boya Aletleri", unit: "set", unit_price: 58, stock_quantity: 240, brand: "Stanley", vat_rate: 20, ean: null },
    { name: "Plastik Boya Tepsisi 25cm", code: "BOY-TEP-PL-25", category: "Boya Aletleri", unit: "adet", unit_price: 18, stock_quantity: 380, brand: "Tamirini", vat_rate: 20, ean: null },
    { name: "Spatula Plastik 10cm", code: "BOY-SPT-10", category: "Boya Aletleri", unit: "adet", unit_price: 14, stock_quantity: 520, brand: "Tamirini", vat_rate: 20, ean: null },
    { name: "Eldiven Tek Sefer Lateks 100'lü", code: "GUV-ELD-LAT-100", category: "Güvenlik", unit: "kutu", unit_price: 145, stock_quantity: 280, brand: "3M", vat_rate: 20, ean: null },
    { name: "FFP2 Toz Maskesi 10'lu", code: "GUV-MSK-FFP2-10", category: "Güvenlik", unit: "paket", unit_price: 85, stock_quantity: 320, brand: "3M", vat_rate: 20, ean: null },
    { name: "İş Eldiveni Naylon Çift", code: "GUV-ELD-NAY-CFT", category: "Güvenlik", unit: "çift", unit_price: 28, stock_quantity: 480, brand: "3M", vat_rate: 20, ean: null },
    { name: "Koruma Gözlüğü Şeffaf", code: "GUV-GOZ-SEF", category: "Güvenlik", unit: "adet", unit_price: 65, stock_quantity: 180, brand: "Uvex", vat_rate: 20, ean: null },
  ],
  dealers: [
    { name: "İnşaat Toptan",       city: "Ankara",   country: "TR", contact_name: "Mehmet İnan",     contact_phone: "905321130001", is_active: true, balance: 3800 },
    { name: "Yapı Market Hasan",   city: "Bursa",    country: "TR", contact_name: "Hasan Yıldız",    contact_phone: "905321130002", is_active: true, balance: 1450 },
    { name: "Demir Hırdavat",      city: "Adana",    country: "TR", contact_name: "Ahmet Demir",     contact_phone: "905321130003", is_active: true, balance: 8500 },
    { name: "Çelik Vidalı Toptan", city: "İstanbul", country: "TR", contact_name: "Selim Çelik",     contact_phone: "905321130004", is_active: true, balance: 6200 },
    { name: "Mehmet Yapı Market",  city: "İzmir",    country: "TR", contact_name: "Mehmet Tezcan",   contact_phone: "905321130005", is_active: true, balance: 720 },
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

// ── Tekstil & Konfeksiyon ───────────────────────────────────────────
const tekstil = {
  slug: "tekstil",
  label: "Tekstil & Konfeksiyon",
  categories: ["Pamuklu Kumaşlar","Polyester & Karışım","Aksesuar","Dikiş Malzeme","Astar"],
  products: [
    { name: "Pamuklu Beyaz Top Kumaş 50m", code: "PAM-BYZ-TOP-50", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1850, stock_quantity: 30, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Penye Pamuk Lacivert 30m", code: "PAM-PEN-LAC-30", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1280, stock_quantity: 24, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Empirme Çiçekli Pamuk 25m", code: "PAM-EMP-CIC-25", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 980, stock_quantity: 18, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Pamuk Twill Bej 40m", code: "PAM-TWL-BEJ-40", category: "Pamuklu Kumaşlar", unit: "top", unit_price: 1420, stock_quantity: 22, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Polyester Karışım Siyah 30m", code: "POL-SYH-30", category: "Polyester & Karışım", unit: "top", unit_price: 850, stock_quantity: 36, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Polyester Mat Beyaz 50m", code: "POL-MAT-BYZ-50", category: "Polyester & Karışım", unit: "top", unit_price: 1120, stock_quantity: 28, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Polar Kumaş Gri 25m", code: "POL-PLR-GRI-25", category: "Polyester & Karışım", unit: "top", unit_price: 720, stock_quantity: 32, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Vual Beyaz Şal 40m", code: "POL-VUL-BYZ-40", category: "Polyester & Karışım", unit: "top", unit_price: 580, stock_quantity: 25, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Fermuar 18cm Plastik 100'lü", code: "AKS-FRM-18-100", category: "Aksesuar", unit: "paket", unit_price: 145, stock_quantity: 240, brand: "YKK", vat_rate: 18, ean: null },
    { name: "Düğme 14mm Beyaz 200'lü", code: "AKS-DUG-14-200", category: "Aksesuar", unit: "paket", unit_price: 65, stock_quantity: 380, brand: "Esin", vat_rate: 18, ean: null },
    { name: "Cırt Bant 25mm × 25m", code: "AKS-CRT-25-25", category: "Aksesuar", unit: "rulo", unit_price: 85, stock_quantity: 180, brand: "Velcro", vat_rate: 18, ean: null },
    { name: "Lastik Bant 30mm × 50m", code: "AKS-LST-30-50", category: "Aksesuar", unit: "rulo", unit_price: 110, stock_quantity: 140, brand: "Esin", vat_rate: 18, ean: null },
    { name: "Pamuk İplik Beyaz 5000m Bobin", code: "DIK-IPL-BYZ-50", category: "Dikiş Malzeme", unit: "bobin", unit_price: 95, stock_quantity: 280, brand: "Sümerbank", vat_rate: 18, ean: null },
    { name: "Polyester İplik Lacivert 5000m", code: "DIK-POL-LAC-50", category: "Dikiş Malzeme", unit: "bobin", unit_price: 78, stock_quantity: 320, brand: "Sümerbank", vat_rate: 18, ean: null },
    { name: "Dikiş İğnesi Universal 90/14 100'lü", code: "DIK-IGN-90-100", category: "Dikiş Malzeme", unit: "paket", unit_price: 45, stock_quantity: 240, brand: "Schmetz", vat_rate: 18, ean: null },
    { name: "Çatal İğne Karışık 50'li", code: "DIK-CTL-IGN-50", category: "Dikiş Malzeme", unit: "paket", unit_price: 32, stock_quantity: 320, brand: "Schmetz", vat_rate: 18, ean: null },
    { name: "Polyester Astar Bej 30m", code: "AST-POL-BEJ-30", category: "Astar", unit: "top", unit_price: 380, stock_quantity: 60, brand: "Anatolia", vat_rate: 18, ean: null },
    { name: "Saten Astar Siyah 25m", code: "AST-SAT-SYH-25", category: "Astar", unit: "top", unit_price: 520, stock_quantity: 40, brand: "İpek Mensucat", vat_rate: 18, ean: null },
    { name: "Tela Yapışkanlı Beyaz 50m", code: "AST-TEL-BYZ-50", category: "Astar", unit: "top", unit_price: 245, stock_quantity: 80, brand: "Bursa Tekstil", vat_rate: 18, ean: null },
    { name: "Vatka Yastık Dolgu 1kg", code: "AST-VTK-1KG", category: "Astar", unit: "paket", unit_price: 65, stock_quantity: 180, brand: "Esin", vat_rate: 18, ean: null },
  ],
  dealers: [
    { name: "Tekstil Sarayı",  city: "Bursa",     country: "TR", contact_name: "Hüseyin Saray",  contact_phone: "905321140001", is_active: true, balance: 4500 },
    { name: "Asya Tekstil",    city: "İstanbul",  country: "TR", contact_name: "Aysun Demirbaş", contact_phone: "905321140002", is_active: true, balance: 2800 },
    { name: "Mehmet Kumaş",    city: "Konya",     country: "TR", contact_name: "Mehmet Tan",     contact_phone: "905321140003", is_active: true, balance: 9800 },
    { name: "Yıldız Kumaş",    city: "İzmir",     country: "TR", contact_name: "Fatma Yıldız",   contact_phone: "905321140004", is_active: true, balance: 1200 },
    { name: "Anadolu Tekstil", city: "Gaziantep", country: "TR", contact_name: "Ahmet Doğan",    contact_phone: "905321140005", is_active: true, balance: 5600 },
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

// ── Kişisel Bakım & Temizlik ────────────────────────────────────────
const temizlik = {
  slug: "temizlik",
  label: "Kişisel Bakım & Temizlik",
  categories: ["Sabun & Şampuan","Deterjan","Yüzey Temizlik","Kağıt Ürünleri","Dezenfektan"],
  products: [
    { name: "Dalan Sıvı Sabun 5L", code: "SAB-DLN-SIV-5", category: "Sabun & Şampuan", unit: "bidon", unit_price: 145, stock_quantity: 180, brand: "Dalan", vat_rate: 8, ean: "8690999500101" },
    { name: "Hacı Şakir Kalıp Sabun 1kg", code: "SAB-HCS-KAL-1", category: "Sabun & Şampuan", unit: "paket", unit_price: 38, stock_quantity: 320, brand: "Hacı Şakir", vat_rate: 8, ean: null },
    { name: "Elidor Şampuan 650ml", code: "SAB-ELD-SMP-65", category: "Sabun & Şampuan", unit: "şişe", unit_price: 85, stock_quantity: 240, brand: "Elidor", vat_rate: 18, ean: null },
    { name: "Pantene Şampuan 600ml", code: "SAB-PNT-SMP-60", category: "Sabun & Şampuan", unit: "şişe", unit_price: 145, stock_quantity: 180, brand: "Pantene", vat_rate: 18, ean: null },
    { name: "Persil Sıvı Çamaşır 5L", code: "DET-PRS-SIV-5", category: "Deterjan", unit: "bidon", unit_price: 320, stock_quantity: 140, brand: "Persil", vat_rate: 18, ean: null },
    { name: "Ariel Toz Çamaşır 7.5kg", code: "DET-ARL-TOZ-75", category: "Deterjan", unit: "kova", unit_price: 285, stock_quantity: 120, brand: "Ariel", vat_rate: 18, ean: null },
    { name: "Pril Bulaşık Deterjanı 1L", code: "DET-PRL-BLS-1", category: "Deterjan", unit: "şişe", unit_price: 65, stock_quantity: 320, brand: "Pril", vat_rate: 18, ean: null },
    { name: "Finish Bulaşık Tableti 60'lı", code: "DET-FNS-TBL-60", category: "Deterjan", unit: "kutu", unit_price: 245, stock_quantity: 90, brand: "Finish", vat_rate: 18, ean: null },
    { name: "Cif Krem Yüzey 750ml", code: "YUZ-CIF-KRM-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 58, stock_quantity: 280, brand: "Cif", vat_rate: 18, ean: null },
    { name: "Mr. Proper Cam Sprey 750ml", code: "YUZ-MRP-CAM-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 48, stock_quantity: 320, brand: "Mr. Proper", vat_rate: 18, ean: null },
    { name: "Domestos Tuvalet Temizleyici 750ml", code: "YUZ-DOM-TUV-75", category: "Yüzey Temizlik", unit: "şişe", unit_price: 52, stock_quantity: 280, brand: "Domestos", vat_rate: 18, ean: null },
    { name: "Ajax Genel Temizleyici 1.5L", code: "YUZ-AJX-GNL-15", category: "Yüzey Temizlik", unit: "şişe", unit_price: 68, stock_quantity: 200, brand: "Ajax", vat_rate: 18, ean: null },
    { name: "Selpak Tuvalet Kağıdı 32'li", code: "KGT-SLP-TUV-32", category: "Kağıt Ürünleri", unit: "paket", unit_price: 220, stock_quantity: 180, brand: "Selpak", vat_rate: 18, ean: null },
    { name: "Lila Tuvalet Kağıdı 24'lü", code: "KGT-LIL-TUV-24", category: "Kağıt Ürünleri", unit: "paket", unit_price: 145, stock_quantity: 220, brand: "Lila", vat_rate: 18, ean: null },
    { name: "Solo Kağıt Havlu 12'li", code: "KGT-SOL-HVL-12", category: "Kağıt Ürünleri", unit: "paket", unit_price: 125, stock_quantity: 200, brand: "Solo", vat_rate: 18, ean: null },
    { name: "Selpak Mendil 100'lü 6'lı Set", code: "KGT-SLP-MEN-6", category: "Kağıt Ürünleri", unit: "set", unit_price: 38, stock_quantity: 380, brand: "Selpak", vat_rate: 18, ean: null },
    { name: "Dezenfektan Sprey 500ml", code: "DZN-SPR-50", category: "Dezenfektan", unit: "şişe", unit_price: 68, stock_quantity: 280, brand: "Dettol", vat_rate: 18, ean: null },
    { name: "El Dezenfektanı Jel 500ml", code: "DZN-JEL-50", category: "Dezenfektan", unit: "şişe", unit_price: 85, stock_quantity: 240, brand: "Dettol", vat_rate: 18, ean: null },
    { name: "Çamaşır Suyu 4L", code: "DZN-CMS-4", category: "Dezenfektan", unit: "bidon", unit_price: 68, stock_quantity: 180, brand: "Domestos", vat_rate: 18, ean: null },
    { name: "Yüzey Dezenfektan 5L Konsantre", code: "DZN-YZ-5", category: "Dezenfektan", unit: "bidon", unit_price: 240, stock_quantity: 80, brand: "Dettol", vat_rate: 18, ean: null },
  ],
  dealers: [
    { name: "Hijyen Toptan",       city: "Ankara",   country: "TR", contact_name: "Mehmet Hijyen",  contact_phone: "905321150001", is_active: true, balance: 3400 },
    { name: "Aytaç Market",        city: "Bursa",    country: "TR", contact_name: "Aytaç Yıldız",   contact_phone: "905321150002", is_active: true, balance: 1850 },
    { name: "Yılmaz Temizlik",     city: "Adana",    country: "TR", contact_name: "Veli Yılmaz",    contact_phone: "905321150003", is_active: true, balance: 8500 },
    { name: "Mehmet Hijyen Tek.",  city: "Konya",    country: "TR", contact_name: "Mehmet Tezcan",  contact_phone: "905321150004", is_active: true, balance: 920 },
    { name: "Asya Bakım Ürünleri", city: "İstanbul", country: "TR", contact_name: "Asya Demirtaş",  contact_phone: "905321150005", is_active: true, balance: 5200 },
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

const REGISTRY = { boya, gida, hirdavat, tekstil, temizlik };

export function getSectorDataset(slug) {
  if (!slug) return boya;
  const k = String(slug).toLowerCase().trim();
  return REGISTRY[k] || boya;
}

export function listSectorSlugs() {
  return Object.keys(REGISTRY);
}
