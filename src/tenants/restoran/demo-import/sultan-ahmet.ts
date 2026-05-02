/**
 * Demo Dataset — Sultan Ahmet Kebabevi (Rotterdam)
 *
 * Hollanda Türk lokantası demo senaryosu için zenginleştirilmiş veri:
 *   - 8 masa (iç salon + bahçe)
 *   - 30 menü kalemi (kebap, mezeler, içecek, tatlı)
 *   - 10 stok kalemi (et, sebze, içecek, 3 kritik seviyede)
 *   - 8 müdavim (loyalty member) — farklı ziyaret profiliyle
 *   - 5 dünkü ödenmiş sipariş (paid)
 *   - 4 bugün rezervasyon + 3 yarın rezervasyon
 *
 * Kullanım: POST /api/restoran-demo/seed?secret=<env> tenant'a yazar.
 * Mevcut veri varsa --force gerek (default: skip).
 */

export interface DemoTable {
  label: string;
  capacity: number;
  zone: string;
  status: "free" | "occupied" | "reserved" | "cleaning";
}

export interface DemoMenuItem {
  name: string;
  category: string;
  price: number;
  description?: string;
  prep_minutes?: number;
}

export interface DemoInventory {
  name: string;
  unit: string;
  quantity: number;
  low_threshold: number;
  supplier_name?: string;
}

export interface DemoLoyaltyMember {
  name: string;
  phone: string;
  birthday?: string;
  visit_count: number;
  total_spent: number;
  days_since_last_visit: number;
  favorite_items?: string[];
  notes?: string;
}

export interface DemoPaidOrder {
  table_label: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  total_amount: number;
  guest_count: number;
  hours_ago: number;     // dünden bugüne kaç saat önce ödendi
  loyalty_member_index?: number;
  items: Array<{ menu_index: number; quantity: number }>;
}

export interface DemoReservation {
  guest_name: string;
  guest_phone: string;
  party_size: number;
  table_label?: string;
  hours_from_now: number;   // negatif = geçmiş, pozitif = gelecek
  status: "pending" | "confirmed" | "seated";
  source: "wa" | "phone" | "walk_in";
  notes?: string;
  loyalty_member_index?: number;
}

// ── Masalar ──────────────────────────────────────────────────────────────

export const DEMO_TABLES: DemoTable[] = [
  { label: "1",  capacity: 2,  zone: "İç Salon", status: "free" },
  { label: "2",  capacity: 4,  zone: "İç Salon", status: "occupied" },
  { label: "3",  capacity: 4,  zone: "İç Salon", status: "occupied" },
  { label: "4",  capacity: 6,  zone: "İç Salon", status: "reserved" },
  { label: "5",  capacity: 2,  zone: "İç Salon", status: "free" },
  { label: "B1", capacity: 4,  zone: "Bahçe",    status: "free" },
  { label: "B2", capacity: 6,  zone: "Bahçe",    status: "free" },
  { label: "B3", capacity: 8,  zone: "Bahçe",    status: "reserved" },
];

// ── Menü ─────────────────────────────────────────────────────────────────

export const DEMO_MENU: DemoMenuItem[] = [
  // Çorba & Mezeler
  { name: "Mercimek Çorbası",         category: "Çorba",   price: 5.50,  prep_minutes: 5,  description: "Geleneksel kırmızı mercimek" },
  { name: "Yayla Çorbası",            category: "Çorba",   price: 5.50,  prep_minutes: 5 },
  { name: "Humus",                    category: "Meze",    price: 6.50,  prep_minutes: 3 },
  { name: "Haydari",                  category: "Meze",    price: 6.50,  prep_minutes: 3 },
  { name: "Patlıcan Salatası",        category: "Meze",    price: 7.00,  prep_minutes: 3 },
  { name: "Çoban Salata",             category: "Salata",  price: 7.50,  prep_minutes: 5 },
  { name: "Mevsim Salata",            category: "Salata",  price: 8.50,  prep_minutes: 5 },

  // Ana Yemekler — Kebaplar
  { name: "Adana Kebap",              category: "Kebap",   price: 18.50, prep_minutes: 15, description: "Acılı el kıyma kebap, közde" },
  { name: "Urfa Kebap",               category: "Kebap",   price: 18.50, prep_minutes: 15, description: "Acısız kıyma kebap" },
  { name: "Beyti Kebap",              category: "Kebap",   price: 22.50, prep_minutes: 18 },
  { name: "İskender Kebap",           category: "Kebap",   price: 21.00, prep_minutes: 15 },
  { name: "Kuzu Şiş",                 category: "Kebap",   price: 24.50, prep_minutes: 18 },
  { name: "Tavuk Şiş",                category: "Kebap",   price: 17.50, prep_minutes: 12 },
  { name: "Tavuk Pirzola",            category: "Kebap",   price: 18.00, prep_minutes: 14 },
  { name: "Karışık Izgara (2 kişi)",  category: "Kebap",   price: 42.00, prep_minutes: 22 },

  // Pide & Lahmacun
  { name: "Lahmacun",                 category: "Pide",    price: 4.50,  prep_minutes: 8 },
  { name: "Kıymalı Pide",             category: "Pide",    price: 12.50, prep_minutes: 12 },
  { name: "Kuşbaşılı Pide",           category: "Pide",    price: 14.00, prep_minutes: 12 },
  { name: "Kaşarlı Pide",             category: "Pide",    price: 11.00, prep_minutes: 10 },

  // Tatlılar
  { name: "Künefe",                   category: "Tatlı",   price: 8.50,  prep_minutes: 10, description: "Antep usulü, kaymakla" },
  { name: "Baklava (3 dilim)",        category: "Tatlı",   price: 7.50,  prep_minutes: 2 },
  { name: "Sütlaç",                   category: "Tatlı",   price: 5.50,  prep_minutes: 2 },
  { name: "Kazandibi",                category: "Tatlı",   price: 6.00,  prep_minutes: 2 },

  // İçecekler
  { name: "Ayran",                    category: "İçecek",  price: 3.00,  prep_minutes: 1 },
  { name: "Şalgam",                   category: "İçecek",  price: 3.50,  prep_minutes: 1 },
  { name: "Çay",                      category: "İçecek",  price: 2.00,  prep_minutes: 2 },
  { name: "Türk Kahvesi",             category: "İçecek",  price: 3.50,  prep_minutes: 5 },
  { name: "Kola (33cl)",              category: "İçecek",  price: 3.50,  prep_minutes: 1 },
  { name: "Su (50cl)",                category: "İçecek",  price: 2.00,  prep_minutes: 1 },
  { name: "Limonata",                 category: "İçecek",  price: 4.00,  prep_minutes: 2 },
];

// ── Stok ─────────────────────────────────────────────────────────────────

export const DEMO_INVENTORY: DemoInventory[] = [
  { name: "Kuzu eti (kıyma)",      unit: "kg",  quantity: 8.5,    low_threshold: 10,  supplier_name: "Halal Vlees BV" },     // KRİTİK
  { name: "Kuzu eti (parça)",      unit: "kg",  quantity: 12.0,   low_threshold: 8,   supplier_name: "Halal Vlees BV" },
  { name: "Tavuk göğüs",           unit: "kg",  quantity: 6.0,    low_threshold: 5,   supplier_name: "Halal Vlees BV" },
  { name: "Pirinç (baldo)",        unit: "kg",  quantity: 25.0,   low_threshold: 10,  supplier_name: "Anadolu Market" },
  { name: "Domates",               unit: "kg",  quantity: 8.0,    low_threshold: 5,   supplier_name: "Versgroen NL" },
  { name: "Soğan",                 unit: "kg",  quantity: 14.0,   low_threshold: 8,   supplier_name: "Versgroen NL" },
  { name: "Maydanoz",              unit: "demet", quantity: 4,    low_threshold: 6,   supplier_name: "Versgroen NL" },         // KRİTİK
  { name: "Ayran (3lt bidon)",     unit: "adet", quantity: 6,     low_threshold: 4,   supplier_name: "Anadolu Market" },
  { name: "Kola kasası",           unit: "kasa", quantity: 2,     low_threshold: 3,   supplier_name: "Drankgroothandel" },     // KRİTİK
  { name: "Künefe peyniri",        unit: "kg",  quantity: 4.0,    low_threshold: 3,   supplier_name: "Anadolu Market" },
];

// ── Müdavimler (Loyalty Members) ─────────────────────────────────────────

export const DEMO_LOYALTY: DemoLoyaltyMember[] = [
  { name: "Murat Yılmaz",     phone: "+31612345001", birthday: "06-15", visit_count: 47, total_spent: 1250.00, days_since_last_visit: 18,
    favorite_items: ["Adana Kebap", "Ayran", "Künefe"], notes: "Genelde Cuma akşamları, masa B2'yi sever" },
  { name: "Ayşe Demir",       phone: "+31612345002", birthday: "05-08", visit_count: 32, total_spent: 890.00,  days_since_last_visit: 5,
    favorite_items: ["Tavuk Şiş", "Mevsim Salata"] },
  { name: "Mehmet Kaya",      phone: "+31612345003", birthday: "11-22", visit_count: 28, total_spent: 720.50,  days_since_last_visit: 12,
    favorite_items: ["Beyti Kebap", "Şalgam"] },
  { name: "Fatma Öztürk",     phone: "+31612345004", birthday: "05-03", visit_count: 19, total_spent: 480.00,  days_since_last_visit: 3,
    favorite_items: ["Lahmacun", "Çoban Salata"], notes: "Acılı sevmez" },
  { name: "Ali Şahin",        phone: "+31612345005", birthday: "09-12", visit_count: 15, total_spent: 410.00,  days_since_last_visit: 8 },
  { name: "Zeynep Aydın",     phone: "+31612345006", birthday: "05-04", visit_count: 11, total_spent: 295.00,  days_since_last_visit: 22,
    favorite_items: ["Künefe"], notes: "Vejetaryen, et yemiyor" },
  { name: "Hasan Çelik",      phone: "+31612345007", birthday: "03-30", visit_count: 8,  total_spent: 215.00,  days_since_last_visit: 35 },
  { name: "Burak Yıldız",     phone: "+31612345008", birthday: "07-19", visit_count: 4,  total_spent: 95.00,   days_since_last_visit: 2 },
];

// ── Dünkü ödenmiş siparişler ─────────────────────────────────────────────

export const DEMO_PAID_ORDERS: DemoPaidOrder[] = [
  { table_label: "2", order_type: "dine_in", total_amount: 47.50, guest_count: 2, hours_ago: 27, loyalty_member_index: 1,
    items: [{ menu_index: 7, quantity: 1 }, { menu_index: 12, quantity: 1 }, { menu_index: 23, quantity: 2 }, { menu_index: 19, quantity: 1 }] },
  { table_label: "B2", order_type: "dine_in", total_amount: 78.00, guest_count: 4, hours_ago: 28,
    items: [{ menu_index: 14, quantity: 1 }, { menu_index: 16, quantity: 4 }, { menu_index: 23, quantity: 4 }, { menu_index: 19, quantity: 2 }] },
  { table_label: "3", order_type: "dine_in", total_amount: 35.50, guest_count: 2, hours_ago: 29,
    items: [{ menu_index: 0, quantity: 2 }, { menu_index: 8, quantity: 1 }, { menu_index: 12, quantity: 1 }, { menu_index: 23, quantity: 2 }] },
  { table_label: "Paket", order_type: "takeaway", total_amount: 22.00, guest_count: 1, hours_ago: 30,
    items: [{ menu_index: 7, quantity: 1 }, { menu_index: 23, quantity: 1 }] },
  { table_label: "Paket", order_type: "takeaway", total_amount: 18.50, guest_count: 1, hours_ago: 31,
    items: [{ menu_index: 16, quantity: 4 }, { menu_index: 23, quantity: 1 }] },
];

// ── Rezervasyonlar ───────────────────────────────────────────────────────

export const DEMO_RESERVATIONS: DemoReservation[] = [
  // Bugün
  { guest_name: "Yılmaz Ailesi", guest_phone: "+31612345099", party_size: 8, table_label: "B3", hours_from_now: 8.5,
    status: "confirmed", source: "wa", notes: "Doğum günü 🎂 — Zeynep teyze 60 yaşında" },
  { guest_name: "Demir Bey", guest_phone: "+31612345101", party_size: 4, table_label: "4", hours_from_now: 9.25,
    status: "confirmed", source: "phone" },
  { guest_name: "Ayşe Demir", guest_phone: "+31612345002", party_size: 2, hours_from_now: 6,
    status: "pending", source: "wa", loyalty_member_index: 1 },
  { guest_name: "Hollandalı çift (Jansen)", guest_phone: "+31612345102", party_size: 2, hours_from_now: 10,
    status: "confirmed", source: "wa", notes: "İlk geliyorlar, Türk mutfağı sevdiklerini söylediler" },
  // Yarın
  { guest_name: "Kaya Ailesi", guest_phone: "+31612345103", party_size: 5, hours_from_now: 30,
    status: "confirmed", source: "wa", notes: "Çocuklu — yüksek sandalye gerekiyor" },
  { guest_name: "İşadamları yemeği (Türker)", guest_phone: "+31612345104", party_size: 6, table_label: "B2", hours_from_now: 32,
    status: "confirmed", source: "phone", notes: "Sessiz köşe istediler" },
  { guest_name: "Fatma Öztürk", guest_phone: "+31612345004", party_size: 3, hours_from_now: 33,
    status: "pending", source: "wa", loyalty_member_index: 3, notes: "Vejetaryen menü hazırlanacak" },
];
