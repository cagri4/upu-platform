/**
 * SiteYönetim demo seed — onboarding sonrası bir binaya örnek veri yazar.
 *
 * Apartman dataset (sektör ayrımı yok): 20 daire (5 kat × 4 daire),
 * 18 sakin (Türk isimleri, dummy phone), 3 dönem aidat (Şubat ödendi,
 * Mart'ta 2 borçlu, Nisan'da 7 borçlu), 3 açık arıza, 8 gelir-gider
 * hareketi.
 *
 * Idempotency: building'de sy_units kaydı varsa skip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SiteyonetimSeedResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  summary?: {
    units: number;
    residents: number;
    dues: number;
    tickets: number;
    cashEntries: number;
  };
}

const UNITS = [
  "1A","1B","1C","1D",
  "2A","2B","2C","2D",
  "3A","3B","3C","3D",
  "4A","4B","4C","4D",
  "5A","5B","5C","5D",
];

// (unit_label, name, phone) — 18 sakin (4D ve 5C boş)
const RESIDENTS: Array<[string, string, string]> = [
  ["1A", "Mehmet Yılmaz",  "905001000001"],
  ["1B", "Ayşe Demir",     "905001000002"],
  ["1C", "Fatma Kaya",     "905001000003"],
  ["1D", "Hüseyin Çelik",  "905001000004"],
  ["2A", "Zeynep Şahin",   "905001000005"],
  ["2B", "Mustafa Aydın",  "905001000006"],
  ["2C", "Elif Öztürk",    "905001000007"],
  ["2D", "Ahmet Kara",     "905001000008"],
  ["3A", "Hatice Arslan",  "905001000009"],
  ["3B", "İbrahim Doğan",  "905001000010"],
  ["3C", "Hayriye Kılıç",  "905001000011"],
  ["3D", "Osman Aslan",    "905001000012"],
  ["4A", "Emine Polat",    "905001000013"],
  ["4B", "Yusuf Yıldız",   "905001000014"],
  ["4C", "Sevim Aksoy",    "905001000015"],
  ["5A", "Ali Korkmaz",    "905001000016"],
  ["5B", "Selma Erdoğan",  "905001000017"],
  ["5D", "Murat Çetin",    "905001000018"],
];

// Borçlu daireler — vade geçmiş aidatlar
const MARCH_UNPAID  = new Set(["1A","4B"]);                              // 2 daire
const APRIL_UNPAID  = new Set(["1A","1C","2B","3A","3D","4B","5A"]);     // 7 daire
const LATE_FEE_KURUS_MARCH = 7500;   // 75 TL gecikme (Mart için)
const LATE_FEE_KURUS_APRIL = 1500;   // 15 TL yeni gecikme (sadece 2 ay üst üste borçlular)
const AIDAT_KURUS = 150000;          // 1500 TL

interface UnitRow { id: string; unit_number: string }

export async function seedSiteyonetimDemoData(
  supabase: SupabaseClient,
  tenantId: string,
  managerId: string,
  buildingId: string,
): Promise<SiteyonetimSeedResult> {
  // Idempotency — bu binada zaten daire varsa skip
  const { count: existingUnits } = await supabase
    .from("sy_units")
    .select("id", { count: "exact", head: true })
    .eq("building_id", buildingId);

  if ((existingUnits || 0) > 0) {
    return {
      ok: false,
      skipped: true,
      reason: `Bu binada zaten ${existingUnits} daire var, demo seed atlandı.`,
    };
  }

  // 1) 20 daire
  const unitsPayload = UNITS.map(label => ({
    building_id: buildingId,
    unit_number: label,
  }));
  const { data: insertedUnits, error: uErr } = await supabase
    .from("sy_units")
    .insert(unitsPayload)
    .select("id, unit_number");
  if (uErr || !insertedUnits) {
    return { ok: false, reason: `Daire insert hatası: ${uErr?.message || "unknown"}` };
  }

  const unitMap = new Map<string, string>();
  for (const u of insertedUnits as UnitRow[]) {
    unitMap.set(u.unit_number, u.id);
  }

  // 2) 18 sakin
  const residentsPayload = RESIDENTS.map(([label, name, phone]) => ({
    building_id: buildingId,
    unit_id: unitMap.get(label),
    name,
    phone,
    is_active: true,
  })).filter(r => r.unit_id);

  const { error: rErr } = await supabase.from("sy_residents").insert(residentsPayload);
  if (rErr) {
    return { ok: false, reason: `Sakin insert hatası: ${rErr.message}` };
  }

  // 3) Aidat ledger — son 3 ay (Şubat hepsi ödendi, Mart 2 borçlu, Nisan 7 borçlu)
  const today = new Date();
  const ymPeriod = (offsetMonths: number): string => {
    const d = new Date(today.getFullYear(), today.getMonth() - offsetMonths, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const periodFeb = ymPeriod(3);  // 3 ay önce
  const periodMar = ymPeriod(2);
  const periodApr = ymPeriod(1);

  const occupiedUnits = RESIDENTS.map(([label]) => label);

  const duesPayload: Array<Record<string, unknown>> = [];

  // Şubat — hepsi ödendi
  for (const label of occupiedUnits) {
    duesPayload.push({
      building_id: buildingId,
      unit_id: unitMap.get(label),
      period: periodFeb,
      amount: AIDAT_KURUS,
      paid_amount: AIDAT_KURUS,
      is_paid: true,
      late_charge_kurus: 0,
    });
  }

  // Mart — 2 borçlu (1A, 4B), 16 ödendi
  for (const label of occupiedUnits) {
    const unpaid = MARCH_UNPAID.has(label);
    duesPayload.push({
      building_id: buildingId,
      unit_id: unitMap.get(label),
      period: periodMar,
      amount: AIDAT_KURUS,
      paid_amount: unpaid ? 0 : AIDAT_KURUS,
      is_paid: !unpaid,
      late_charge_kurus: unpaid ? LATE_FEE_KURUS_MARCH : 0,
    });
  }

  // Nisan — 7 borçlu, 11 ödendi
  for (const label of occupiedUnits) {
    const unpaid = APRIL_UNPAID.has(label);
    duesPayload.push({
      building_id: buildingId,
      unit_id: unitMap.get(label),
      period: periodApr,
      amount: AIDAT_KURUS,
      paid_amount: unpaid ? 0 : AIDAT_KURUS,
      is_paid: !unpaid,
      // 2 ay üst üste borçlulara ekstra gecikme — Mart'ta da borçlu olan 1A ve 4B
      late_charge_kurus: unpaid && MARCH_UNPAID.has(label) ? LATE_FEE_KURUS_APRIL : 0,
    });
  }

  const { error: dErr } = await supabase.from("sy_dues_ledger").insert(duesPayload);
  if (dErr) {
    return { ok: false, reason: `Aidat insert hatası: ${dErr.message}` };
  }

  // 4) 3 açık arıza
  const ticketsPayload = [
    {
      building_id: buildingId,
      unit_id: null,
      reported_by_user_id: managerId,
      category: "asansor",
      priority: "acil",
      description: "Sağ asansör 3. katta takılıyor, kapı tam kapanmıyor. Servis çağrıldı.",
      status: "acik",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),  // 2 saat önce
    },
    {
      building_id: buildingId,
      unit_id: unitMap.get("2C"),
      reported_by_user_id: managerId,
      category: "su",
      priority: "normal",
      description: "Daire 2C banyodan su kaçıyor, alt daireye sızıntı başladı.",
      status: "acik",
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 gün önce
    },
    {
      building_id: buildingId,
      unit_id: null,
      reported_by_user_id: managerId,
      category: "elektrik",
      priority: "acil",
      description: "B blok merdiven aydınlatması çalışmıyor, akşam karanlık.",
      status: "acik",
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),  // 6 saat önce
    },
  ];

  const { error: tErr } = await supabase.from("sy_maintenance_tickets").insert(ticketsPayload);
  if (tErr) {
    return { ok: false, reason: `Arıza insert hatası: ${tErr.message}` };
  }

  // 5) Gelir-gider hareketleri (Şubat–Nisan)
  const cashPayload = [
    { building_id: buildingId, type: "income",  category: "aidat",    description: "Şubat aidat tahsilatı",          amount_kurus: 2700000, period: periodFeb },
    { building_id: buildingId, type: "income",  category: "aidat",    description: "Mart aidat tahsilatı",           amount_kurus: 2400000, period: periodMar },
    { building_id: buildingId, type: "income",  category: "aidat",    description: "Nisan aidat tahsilatı (kısmi)",  amount_kurus: 1650000, period: periodApr },
    { building_id: buildingId, type: "expense", category: "temizlik", description: "Genel temizlik personeli maaşı", amount_kurus:  450000, period: periodApr },
    { building_id: buildingId, type: "expense", category: "elektrik", description: "Ortak alan elektrik faturası",    amount_kurus:   85000, period: periodApr },
    { building_id: buildingId, type: "expense", category: "asansor",  description: "Asansör yıllık bakım sözleşmesi", amount_kurus:  120000, period: periodMar },
    { building_id: buildingId, type: "expense", category: "guvenlik", description: "Güvenlik kamerası onarımı",       amount_kurus:   65000, period: periodApr },
    { building_id: buildingId, type: "expense", category: "su",       description: "Ortak alan su faturası",          amount_kurus:   32000, period: periodApr },
  ];

  const { error: cErr } = await supabase.from("sy_income_expenses").insert(cashPayload);
  if (cErr) {
    return { ok: false, reason: `Gelir-gider insert hatası: ${cErr.message}` };
  }

  // tenantId bilgi amaçlı — şu an kullanmıyoruz ama imzanın bayi pattern'ine
  // uyması için tutuluyor, ileride çoklu-tenant filtrelerde kullanılabilir.
  void tenantId;

  return {
    ok: true,
    summary: {
      units: insertedUnits.length,
      residents: residentsPayload.length,
      dues: duesPayload.length,
      tickets: ticketsPayload.length,
      cashEntries: cashPayload.length,
    },
  };
}
