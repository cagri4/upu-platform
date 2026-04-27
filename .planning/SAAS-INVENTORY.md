# upu-platform — SaaS Dikey Envanteri

Her aktif SaaS'ın 1 sayfalık özeti. Yeni SaaS eklerken benzeri bir SaaS'ı
model alabilmek için referans.

> **Şu an aktif: 6 SaaS.** Tüm tenant tanımları `src/tenants/config.ts` içindeki
> TENANTS registry'sinde. Her birinin tenantId, slug, employees, commands tanımlı.

---

## emlak (Emlak Ofisi)

**Slug:** `estateai` · **Domain:** estateai.upudev.nl · **Renk:** #4F46E5 🏠

**Amaç:** Emlak danışmanları (özellikle Bodrum bölgesi) için sanal ofis ekibi.
Portföy yönetimi, müşteri takibi, AI sunum üretimi, sahibinden günlük ilan
brifingi, sözleşme oluşturma, kişisel web sayfa.

**Sanal Çalışanlar (5):** Portföy Sorumlusu (🗂), Satış Destek (🤝), Medya
Uzmanı (🎬), Pazar Analisti (📊), Sekreter (📋)

**Komutlar (23):**
- **Portföy:** `mulkekle`, `mulklerim`, `portfoy-ara`, `portfolio`, `ilan-takip`
- **Sunum:** `sunum-olustur`, `sunum`, `medya`
- **Müşteri/CRM:** `musteri-ekle`, `musteri-duzenle`, `musteriler`,
  `musteri-takip`, `eslestir`, `satis-tavsiye`
- **Sözleşme:** `sozlesme`, `sozlesmelerim` (yetkilendirme + imza linki + PDF)
- **Profil/Marka:** `profil-duzenle`, `web-sayfam`
- **Yardımcı:** `fiyat-belirle`, `hatirlatma`, `ipucu`, `tamamla`, `webpanel`

**Onboarding adımları:** Ad, telefon, ofis adı, bölge (Bodrum varsayılan),
deneyim yılı, brifing tercihi.

**Agent V2 (6):** kullanım çeşitli (medya, satış, pazar). Detay:
`tenants/emlak/agents/`

**Kritik dosyalar:**
- `commands/mulkekle.ts` — web form magic link
- `commands/sozlesme.ts` — TC/telefon/münhasır/komisyon flow
- `app/api/sunum/finish/route.ts` — sunum + chain
- `scripts/scrape-v3.mjs` — sahibinden Puppeteer scrape

**DB tabloları (kısmi):** `emlak_properties`, `emlak_customers`,
`emlak_presentations`, `emlak_daily_leads`, `emlak_takip`, `emlak_publishing_history`,
`contracts`, `magic_link_tokens`, `extension_tokens`

**Domain context:** Bodrum-only (BODRUM_KEYWORDS whitelist), sahibinden
3-parti scrape (03:00/04:30/06:00 cron), Chrome uzantısı sahibinden form
doldurma.

**Olgunluk:** **Production**, en aktif geliştirilen SaaS.

---

## bayi (Bayi Yönetimi)

**Slug:** `retailai` · **Renk:** #059669 📦

**Amaç:** Dağıtım/bayilik ağları için sipariş, stok, tahsilat ve lojistik
yönetimi. Bayi ağında ürün dağıtımı, fiyat yönetimi, satış hedefleri ve
pazarlama kampanyaları merkezi.

**Sanal Çalışanlar (9):** Asistan (📊), Satış Müdürü (💰), Satış Temsilcisi (🤝),
Muhasebeci (💳), Tahsildar (📋), Depocu (📦), Lojistikçi (🚛), Ürün Yöneticisi
(🏷), Ekip Yönetimi (👥)

**Komutlar (19):** stok, siparis, dealer, dealer-onboarding, tahsilat, bakiye,
kalisan, kampanya, lojistik, takvim, bildirim, bayi-durum, bayi-davet, urunler,
rapor, ozet, insight, ...

**Onboarding:** Firma adı, ağ büyüklüğü (1-10/11-50/50+), brifing tercihi.

**Agent V2 (2):** `bayi-upu.ts` (49KB — büyük V2 entegre AI), 1 daha

**Kritik dosyalar:** `dealer.ts` (15KB), `siparis.ts` (15KB), `bayi-upu.ts` (49KB)

**DB tabloları (15):** `bayi_products`, `bayi_orders`, `bayi_order_items`,
`bayi_dealers`, `bayi_dealer_invoices`, `bayi_dealer_transactions`,
`bayi_purchase_orders`, `bayi_suppliers`, `bayi_sales_targets`,
`bayi_campaigns`, `bayi_dealer_visits`, `bayi_collection_activities`,
`bayi_transaction_types`, `bayi_order_statuses`

**Olgunluk:** **Production.** En geniş DB schema, kompleks tahsilat akışları.

---

## otel (Otel Yönetim)

**Slug:** `otelai` (varsayım, config kontrol) · **Renk:** turuncu/mavi 🏨

**Amaç:** Otel rezervasyon, check-in/out, oda, misafir, temizlik ve gelir
yönetimi. Doluluk tahmini, revenue management, misafir deneyimi.

**Komutlar (19):** rezervasyonlar, checkin-checkout, doluluk, durum, gelir,
misafirler, musaitlik, odalar, oda-guncelle, yorumlar, yanitla, temizlik,
gorev-ata, rezervasyon-ekle, rezervasyon-yonetim, brifing, rapor, ...

**Onboarding:** Otel adı, konum, oda sayısı, brifing tercihi.

**Agent V2 (5):** dosya sayısı yüksek ama **agents/** dizini henüz V2 framework'e
tam dahil edilmemiş olabilir (otel'in agents/'ı boş gibi gözüktü ilk taramada,
ama orient.sh 5 sayıyor — kontrol et).

**Kritik dosyalar:** `doluluk.ts` (occupancy + 7-gün forecast), `rezervasyonlar.ts`,
`gelir.ts`

**DB tabloları (8):** `otel_reservations`, `otel_rooms`, `otel_hotels`,
`otel_housekeeping_tasks`, `otel_guest_messages`, `otel_guest_requests`,
`otel_guest_reviews`, `otel_user_hotels`

**Olgunluk:** **Active dev** → production yakını. Komplekslik yüksek (rezervasyon-
heavy).

---

## market (Perakende)

**Slug:** muhtemelen `marketai` · **Renk:** ?

**Amaç:** Küçük/orta ölçekli perakende (bakkal, supermarket, toptan) için stok,
satış ve kasa yönetimi. Günlük satış kaydı, stok güncelleme, tedarikçi
yönetimi, finansal raporlama.

**Komutlar (11):** stok, siparis, kasa, fiyat, kategori, skt (son kullanma
tarihi), teslimat, brifing, rapor, ...

**Onboarding:** Mağaza adı, market türü (bakkal/supermarket/toptan), ürün
çeşidi sayısı, brifing tercihi.

**Agent V2 (4):** `siparis-yoneticisi.ts`, `finans-analisti.ts` (18KB),
`stok-sorumlusu.ts`, ...

**Kritik dosyalar:** `stok.ts` (14KB), `finans-analisti.ts` (18KB), `kasa.ts`

**DB tabloları (6):** `mkt_products`, `mkt_orders`, `mkt_order_items`,
`mkt_suppliers`, `mkt_sales`, `mkt_campaigns`

**Olgunluk:** **Active dev.** Hazır agent framework, perakende odaklı temel
operasyonlar tamam.

---

## muhasebe (Mali Müşavir)

**Slug:** muhtemelen `muhasebeai` · **Renk:** ?

**Amaç:** Muhasebe büroları ve mali müşavirler için mükellef hizmetleri:
fatura işleme, tahsilat, vergi hesapları, beyanname yönetimi, riskli mukellef
analizi.

**Komutlar (7):** fatura, tahsilat, vergi, sekreter, ek-komutlar, ...

**Onboarding:** Büro adı, mukellef sayısı, en çok beyanname türü, brifing
tercihi.

**Agent V2 (5):** `fatura-uzmani.ts` (15KB), `tahsilat-uzmani.ts`,
`vergi-uzmani.ts`, `sekreter.ts`

**Kritik dosyalar:** `fatura-uzmani.ts`, `tahsilat.ts`, `vergi.ts`

**DB tabloları (9):** `muh_invoices`, `muh_mukellefler`, `muh_payments`,
`muh_expenses`, `muh_appointments`, `muh_tax_rates`, `muh_reminders`,
`muh_tahsilat_reminders`, `muh_beyanname_statuses`

**Olgunluk:** **Active dev → production.** Tam agent coverage (4 V2 agent),
vergi/beyanname odaklı, yüksek komplekslik.

---

## siteyonetim (Bina/Site Yönetim)

**Slug:** muhtemelen `siteyonetimai` · **Renk:** ?

**Amaç:** Bina/site/apartman yönetimi: daireler, aidat, arıza bildirimi,
gelir-gider, duyurular, hukuki işlemler. Yönetici-sakin iletişimi merkezi.

**Komutlar (10):** aidat, ariza, binakodu, kayit, borcum, durum, duyuru, rapor,
...

**Onboarding:** Bina/site adı, daire sayısı, aylık aidat tutarı, brifing
tercihi.

**Agent V2 (5):** `sekreter.ts`, `teknisyen.ts`, `hukuk.ts` (17KB), `muhasebeci.ts`

**Kritik dosyalar:** `hukuk.ts` (17KB — V2 agent yasal işlemler), `aidat.ts`,
`ariza.ts`

**DB tabloları (7):** `sy_buildings`, `sy_units`, `sy_residents`,
`sy_dues_ledger`, `sy_maintenance_tickets`, `sy_income_expenses`,
`sy_user_residents`

**Olgunluk:** **Active dev.** Niche ama specialized — gayrimenkul yönetimi +
hukuki danışmanlık.

---

## Karşılaştırma Tablosu

| SaaS         | Komut # | Agent V2 # | DB Tablo # | Olgunluk     | Tipik Kullanıcı                  |
|--------------|---------|------------|------------|--------------|----------------------------------|
| emlak        | 23      | 6          | ~10        | Production   | Emlak danışmanı (Bodrum)         |
| bayi         | 19      | 2          | 15         | Production   | Distribütör/bayilik şirketi      |
| otel         | 19      | 5*         | 8          | Active dev   | Otel yöneticisi/işletmecisi      |
| market       | 11      | 4          | 6          | Active dev   | Bakkal/supermarket/toptan sahibi |
| muhasebe     | 7       | 5          | 9          | Active dev   | Mali müşavir/muhasebe bürosu     |
| siteyonetim  | 10      | 5          | 7          | Active dev   | Site/apartman yöneticisi         |

*otel agents/'ın V2 olup olmadığı kontrol edilmeli.

## Ortak Patternler

Hepsinde:
- WhatsApp bot (31644967207) üzerinden komut
- Onboarding → ad + tenant-spesifik bilgiler + brifing tercihi
- `command_sessions` ile multi-step komut state'i
- `profiles.metadata` jsonb içinde tenant-specific user data
- Günlük brifing seçeneği (sabah saatlerinde push)
- TENANTS registry'de `employees` (sanal çalışanlar) → menüde grup
- `commands/index.ts` ile komut + callback + alias kayıt

## Sıradaki Doküman

→ `ADD-NEW-SAAS.md` — yeni SaaS dikey eklemek için adım adım recipe.
