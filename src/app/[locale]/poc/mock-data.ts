/**
 * POC Mock Data — Faz 0.5 Tasarım Dili Karşılaştırması
 *
 * Bu dosyadaki TÜM veri sahte. Hiçbir API çağrısı yapılmaz.
 * 3 POC stil de (v1-minimalism, v2-bento, v3-modern-dashboard) bu veriyi paylaşır.
 *
 * Senaryo: Mehmet Bey gıda toptancısı. Hollanda'daki Türk marketlerine dağıtım yapıyor.
 * 10 bayisi var, 30 ürün satıyor, son dönemde 50 sipariş geçti.
 */

export type Bayi = {
  id: string;
  ad: string;
  sehir: string;
  yetkili: string;
  telefon: string;
  durum: "aktif" | "gecikmis" | "pasif";
  toplamCiro: number; // ₺
  sonSiparis: string; // ISO date
};

export type Urun = {
  id: string;
  ad: string;
  kategori: "Makarna" | "Konserve" | "Süt Ürünleri" | "İçecek" | "Yağ" | "Un / Bakliyat";
  birim: "kg" | "lt" | "adet" | "koli";
  fiyat: number; // ₺
  stok: number;
};

export type SiparisDurum = "beklemede" | "onaylandi" | "hazirlaniyor" | "yolda" | "teslim" | "iptal";

export type SiparisKalem = {
  urunId: string;
  urunAd: string;
  miktar: number;
  birim: Urun["birim"];
  birimFiyat: number;
};

export type Siparis = {
  id: string;
  siparisNo: string;
  bayiId: string;
  bayiAd: string;
  tarih: string; // ISO date
  kalemSayisi: number;
  tutar: number; // ₺
  durum: SiparisDurum;
  kalemler: SiparisKalem[];
  not?: string;
};

// ─────────────────────────────────────────────────────────────
// 10 BAYİ (Hollanda'daki Türk marketleri — gerçekçi isimler)
// ─────────────────────────────────────────────────────────────
export const bayiler: Bayi[] = [
  { id: "b01", ad: "Yıldız Market", sehir: "Amsterdam", yetkili: "Ahmet Yıldız", telefon: "+31 6 1234 5678", durum: "aktif", toplamCiro: 248_650, sonSiparis: "2026-06-08" },
  { id: "b02", ad: "Akdeniz Gıda", sehir: "Rotterdam", yetkili: "Selin Demir", telefon: "+31 6 2345 6789", durum: "aktif", toplamCiro: 412_300, sonSiparis: "2026-06-09" },
  { id: "b03", ad: "Mavi Toptan", sehir: "Den Haag", yetkili: "Murat Kara", telefon: "+31 6 3456 7890", durum: "gecikmis", toplamCiro: 89_120, sonSiparis: "2026-05-22" },
  { id: "b04", ad: "Anadolu Market", sehir: "Utrecht", yetkili: "Esra Polat", telefon: "+31 6 4567 8901", durum: "aktif", toplamCiro: 156_780, sonSiparis: "2026-06-08" },
  { id: "b05", ad: "Boğaziçi Süpermarket", sehir: "Eindhoven", yetkili: "Cem Aksoy", telefon: "+31 6 5678 9012", durum: "aktif", toplamCiro: 322_440, sonSiparis: "2026-06-09" },
  { id: "b06", ad: "Çınar Gıda", sehir: "Tilburg", yetkili: "Burak Yılmaz", telefon: "+31 6 6789 0123", durum: "gecikmis", toplamCiro: 67_500, sonSiparis: "2026-05-18" },
  { id: "b07", ad: "Lale Market", sehir: "Groningen", yetkili: "Ayşe Şahin", telefon: "+31 6 7890 1234", durum: "aktif", toplamCiro: 198_900, sonSiparis: "2026-06-07" },
  { id: "b08", ad: "Marmara Toptan", sehir: "Almere", yetkili: "Hakan Uçar", telefon: "+31 6 8901 2345", durum: "aktif", toplamCiro: 287_650, sonSiparis: "2026-06-09" },
  { id: "b09", ad: "Gül Bakkaliyesi", sehir: "Haarlem", yetkili: "Zeynep Arslan", telefon: "+31 6 9012 3456", durum: "gecikmis", toplamCiro: 45_200, sonSiparis: "2026-05-15" },
  { id: "b10", ad: "Pamuk Gıda", sehir: "Nijmegen", yetkili: "Tolga Erdem", telefon: "+31 6 0123 4567", durum: "aktif", toplamCiro: 178_450, sonSiparis: "2026-06-08" },
];

// ─────────────────────────────────────────────────────────────
// 30 ÜRÜN (gıda — makarna, salça, peynir, çay, yağ, un, vb.)
// ─────────────────────────────────────────────────────────────
export const urunler: Urun[] = [
  // Makarna (5)
  { id: "u01", ad: "Spagetti 500g", kategori: "Makarna", birim: "koli", fiyat: 320, stok: 145 },
  { id: "u02", ad: "Penne Makarna 500g", kategori: "Makarna", birim: "koli", fiyat: 310, stok: 132 },
  { id: "u03", ad: "Burgu Makarna 500g", kategori: "Makarna", birim: "koli", fiyat: 295, stok: 87 },
  { id: "u04", ad: "Erişte 250g", kategori: "Makarna", birim: "koli", fiyat: 380, stok: 64 },
  { id: "u05", ad: "Şehriye 250g", kategori: "Makarna", birim: "koli", fiyat: 165, stok: 210 },
  // Konserve / Salça (6)
  { id: "u06", ad: "Domates Salçası 700g", kategori: "Konserve", birim: "koli", fiyat: 540, stok: 96 },
  { id: "u07", ad: "Biber Salçası 700g", kategori: "Konserve", birim: "koli", fiyat: 580, stok: 78 },
  { id: "u08", ad: "Doğranmış Domates 400g", kategori: "Konserve", birim: "koli", fiyat: 420, stok: 134 },
  { id: "u09", ad: "Nohut Konserve 800g", kategori: "Konserve", birim: "koli", fiyat: 365, stok: 102 },
  { id: "u10", ad: "Fasulye Konserve 800g", kategori: "Konserve", birim: "koli", fiyat: 370, stok: 88 },
  { id: "u11", ad: "Mısır Konserve 300g", kategori: "Konserve", birim: "koli", fiyat: 285, stok: 156 },
  // Süt Ürünleri (5)
  { id: "u12", ad: "Beyaz Peynir 500g (vakum)", kategori: "Süt Ürünleri", birim: "kg", fiyat: 245, stok: 58 },
  { id: "u13", ad: "Kaşar Peynir 700g", kategori: "Süt Ürünleri", birim: "kg", fiyat: 320, stok: 42 },
  { id: "u14", ad: "Süzme Yoğurt 1kg", kategori: "Süt Ürünleri", birim: "adet", fiyat: 85, stok: 124 },
  { id: "u15", ad: "Tereyağı 250g", kategori: "Süt Ürünleri", birim: "adet", fiyat: 178, stok: 96 },
  { id: "u16", ad: "Lor Peyniri 500g", kategori: "Süt Ürünleri", birim: "kg", fiyat: 155, stok: 38 },
  // İçecek (4)
  { id: "u17", ad: "Türk Çayı 500g", kategori: "İçecek", birim: "koli", fiyat: 685, stok: 145 },
  { id: "u18", ad: "Bergamot Çayı 200g", kategori: "İçecek", birim: "koli", fiyat: 380, stok: 78 },
  { id: "u19", ad: "Türk Kahvesi 250g", kategori: "İçecek", birim: "koli", fiyat: 520, stok: 92 },
  { id: "u20", ad: "Ayran 200ml (12'li)", kategori: "İçecek", birim: "koli", fiyat: 480, stok: 156 },
  // Yağ (4)
  { id: "u21", ad: "Ayçiçek Yağı 5lt", kategori: "Yağ", birim: "lt", fiyat: 645, stok: 68 },
  { id: "u22", ad: "Zeytinyağı (Sızma) 1lt", kategori: "Yağ", birim: "lt", fiyat: 580, stok: 84 },
  { id: "u23", ad: "Zeytinyağı (Riviera) 5lt", kategori: "Yağ", birim: "lt", fiyat: 1_650, stok: 32 },
  { id: "u24", ad: "Mısır Yağı 5lt", kategori: "Yağ", birim: "lt", fiyat: 720, stok: 56 },
  // Un / Bakliyat (6)
  { id: "u25", ad: "Buğday Unu 25kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 920, stok: 48 },
  { id: "u26", ad: "Pirinç (Baldo) 5kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 480, stok: 76 },
  { id: "u27", ad: "Bulgur (Pilavlık) 5kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 320, stok: 92 },
  { id: "u28", ad: "Mercimek (Kırmızı) 5kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 385, stok: 68 },
  { id: "u29", ad: "Nohut 5kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 410, stok: 54 },
  { id: "u30", ad: "Yeşil Mercimek 5kg", kategori: "Un / Bakliyat", birim: "kg", fiyat: 365, stok: 62 },
];

// ─────────────────────────────────────────────────────────────
// 50 SİPARİŞ — son 4 hafta, gerçekçi dağılım
// ─────────────────────────────────────────────────────────────
function tarih(daysAgo: number): string {
  const d = new Date("2026-06-09T10:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function siparisOlustur(
  no: string,
  bayiIdx: number,
  daysAgo: number,
  durum: SiparisDurum,
  urunIdxs: number[],
  miktarlar: number[],
  not?: string,
): Siparis {
  const bayi = bayiler[bayiIdx];
  const kalemler: SiparisKalem[] = urunIdxs.map((i, k) => {
    const u = urunler[i];
    return {
      urunId: u.id,
      urunAd: u.ad,
      miktar: miktarlar[k],
      birim: u.birim,
      birimFiyat: u.fiyat,
    };
  });
  const tutar = kalemler.reduce((s, k) => s + k.miktar * k.birimFiyat, 0);
  return {
    id: `s${no}`,
    siparisNo: `SIP-2026-${no}`,
    bayiId: bayi.id,
    bayiAd: bayi.ad,
    tarih: tarih(daysAgo),
    kalemSayisi: kalemler.length,
    tutar,
    durum,
    kalemler,
    not,
  };
}

export const siparisler: Siparis[] = [
  // BUGÜN (0 gün) — 12 sipariş
  siparisOlustur("0501", 0, 0, "beklemede", [0, 5, 16], [4, 2, 3]),
  siparisOlustur("0502", 1, 0, "beklemede", [11, 12, 14], [2, 1, 5]),
  siparisOlustur("0503", 4, 0, "onaylandi", [20, 21, 24], [3, 4, 2]),
  siparisOlustur("0504", 7, 0, "hazirlaniyor", [0, 1, 2, 5], [5, 3, 2, 4]),
  siparisOlustur("0505", 9, 0, "beklemede", [16, 17, 18], [3, 2, 4]),
  siparisOlustur("0506", 1, 0, "onaylandi", [5, 6, 7], [4, 3, 2]),
  siparisOlustur("0507", 3, 0, "hazirlaniyor", [11, 12, 13, 14], [2, 1, 1, 3]),
  siparisOlustur("0508", 6, 0, "beklemede", [0, 5, 20], [3, 2, 2]),
  siparisOlustur("0509", 4, 0, "yolda", [24, 25, 26], [4, 5, 3]),
  siparisOlustur("0510", 0, 0, "beklemede", [16, 17], [5, 2], "Acil"),
  siparisOlustur("0511", 7, 0, "yolda", [20, 21], [4, 3]),
  siparisOlustur("0512", 1, 0, "onaylandi", [0, 1, 2, 5, 6], [4, 2, 3, 2, 1]),
  // DÜN (1 gün) — 8 sipariş
  siparisOlustur("0501-D", 2, 1, "iptal", [11, 13], [2, 1], "Bayi iptal etti"),
  siparisOlustur("0502-D", 5, 1, "yolda", [20, 21, 24], [3, 4, 2]),
  siparisOlustur("0503-D", 0, 1, "teslim", [0, 5, 16], [4, 3, 2]),
  siparisOlustur("0504-D", 7, 1, "teslim", [11, 12, 14], [2, 1, 3]),
  siparisOlustur("0505-D", 9, 1, "yolda", [16, 17, 18, 19], [3, 2, 2, 4]),
  siparisOlustur("0506-D", 1, 1, "teslim", [25, 26, 27], [5, 4, 3]),
  siparisOlustur("0507-D", 4, 1, "yolda", [0, 5, 20], [4, 3, 2]),
  siparisOlustur("0508-D", 3, 1, "iptal", [11, 12], [1, 1], "Stok yok"),
  // 2-3 GÜN — 10 sipariş
  siparisOlustur("0490", 0, 2, "teslim", [0, 5, 16, 20], [5, 3, 4, 2]),
  siparisOlustur("0491", 1, 2, "teslim", [11, 12, 13, 14, 15], [3, 2, 1, 2, 1]),
  siparisOlustur("0492", 4, 2, "teslim", [24, 25, 26, 27], [4, 5, 3, 3]),
  siparisOlustur("0493", 7, 2, "teslim", [0, 5, 20, 21], [4, 3, 2, 3]),
  siparisOlustur("0494", 2, 3, "teslim", [11, 12, 14], [2, 1, 2]),
  siparisOlustur("0495", 5, 3, "teslim", [16, 17, 18], [4, 3, 2]),
  siparisOlustur("0496", 9, 3, "teslim", [25, 26], [3, 2]),
  siparisOlustur("0497", 6, 3, "teslim", [11, 13], [2, 1]),
  siparisOlustur("0498", 0, 3, "teslim", [0, 5, 6, 16], [4, 2, 2, 3]),
  siparisOlustur("0499", 8, 3, "teslim", [20, 21, 24], [4, 3, 2]),
  // 4-7 GÜN — 12 sipariş
  siparisOlustur("0480", 1, 4, "teslim", [0, 5, 11, 16], [5, 3, 2, 3]),
  siparisOlustur("0481", 4, 4, "teslim", [20, 21, 24, 25], [4, 3, 2, 4]),
  siparisOlustur("0482", 7, 5, "teslim", [11, 12, 13, 14], [2, 2, 1, 2]),
  siparisOlustur("0483", 0, 5, "teslim", [0, 5, 16, 20], [5, 3, 3, 2]),
  siparisOlustur("0484", 9, 5, "teslim", [25, 26, 27, 28], [3, 4, 2, 2]),
  siparisOlustur("0485", 2, 6, "teslim", [11, 13, 14], [2, 1, 2]),
  siparisOlustur("0486", 5, 6, "teslim", [16, 17, 19], [4, 2, 5]),
  siparisOlustur("0487", 1, 6, "teslim", [0, 5, 11, 20], [4, 2, 2, 3]),
  siparisOlustur("0488", 7, 7, "teslim", [11, 12, 14, 25], [3, 2, 2, 3]),
  siparisOlustur("0489", 4, 7, "teslim", [24, 25, 26], [4, 5, 3]),
  siparisOlustur("0489-B", 0, 7, "teslim", [0, 5, 16], [5, 3, 3]),
  siparisOlustur("0489-C", 8, 7, "teslim", [20, 21, 24, 25], [4, 3, 2, 4]),
  // 8-15 GÜN — 6 sipariş
  siparisOlustur("0470", 1, 9, "teslim", [11, 12, 13], [2, 2, 1]),
  siparisOlustur("0471", 4, 10, "teslim", [20, 21], [4, 3]),
  siparisOlustur("0472", 7, 11, "teslim", [0, 5, 11], [4, 2, 2]),
  siparisOlustur("0473", 0, 12, "teslim", [25, 26], [3, 4]),
  siparisOlustur("0474", 9, 14, "teslim", [16, 17], [3, 2]),
  siparisOlustur("0475", 5, 15, "teslim", [11, 13, 14, 25], [2, 1, 2, 3]),
  // GECİKEN BAYİLERDEN ESKİ SİPARİŞLER — 2 sipariş
  siparisOlustur("0450", 5, 22, "teslim", [11, 12, 14], [2, 1, 2]),
  siparisOlustur("0451", 8, 25, "teslim", [25, 26, 27], [3, 4, 2]),
];

// ─────────────────────────────────────────────────────────────
// DASHBOARD KPI'ları (siparişlerden türetilir)
// ─────────────────────────────────────────────────────────────
const bugun = siparisler.filter((s) => {
  const d = new Date(s.tarih);
  const t = new Date("2026-06-09T10:00:00Z");
  return d.toDateString() === t.toDateString();
});

export const kpi = {
  bugunkuSiparis: bugun.length, // 12
  bugunkuCiro: bugun.reduce((s, k) => s + k.tutar, 0), // ~312k
  bekleyenOnay: siparisler.filter((s) => s.durum === "beklemede").length,
  gecikenBayi: bayiler.filter((b) => b.durum === "gecikmis").length,
};

// Geciken bayiler (dashboard widget'ı için)
export const gecikenBayiler = bayiler.filter((b) => b.durum === "gecikmis");

// Son 10 sipariş (dashboard tablosu için)
export const sonSiparisler = [...siparisler]
  .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
  .slice(0, 10);

// ─────────────────────────────────────────────────────────────
// Yardımcı formatlar
// ─────────────────────────────────────────────────────────────
export const fmtPara = (n: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

export const fmtTarih = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtTarihKisa = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
};

export const durumLabel: Record<SiparisDurum, string> = {
  beklemede: "Beklemede",
  onaylandi: "Onaylandı",
  hazirlaniyor: "Hazırlanıyor",
  yolda: "Yolda",
  teslim: "Teslim Edildi",
  iptal: "İptal",
};

// 7 günlük ciro trend (V3 chart için)
export const haftalikCiro: { gun: string; tutar: number }[] = (() => {
  const out: { gun: string; tutar: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const gun = new Date("2026-06-09T10:00:00Z");
    gun.setUTCDate(gun.getUTCDate() - i);
    const gunStr = gun.toDateString();
    const tutar = siparisler
      .filter((s) => new Date(s.tarih).toDateString() === gunStr)
      .reduce((s, k) => s + k.tutar, 0);
    out.push({
      gun: gun.toLocaleDateString("tr-TR", { weekday: "short" }),
      tutar,
    });
  }
  return out;
})();
