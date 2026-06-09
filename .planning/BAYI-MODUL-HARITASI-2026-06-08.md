# Bayi (Dağıtıcı) SaaS Modül Haritası
> 2026-06-08 — sektör standardı modüller + mevcut UPU bayi gap analizi
> Araştırma süresi: ~35 dk web + ~10 dk kod incelemesi.

## Özet

- **Araştırılan ürünler:** Logo Tiger 3 Enterprise (TR), Mikro Fly (TR), Nebim V3 (TR), NetSuite Wholesale Distribution (US), SAP Business One Distribution (DE). Ek olarak Türkiye saha satış yazılımları (MobilRut, Evobulut, Ekmob) modül referansı için tarandı.
- **Toplam tespit edilen modül:** 32 (Core 8 + Operasyonel 12 + Stratejik 8 + İleri/AI 4)
- **Mevcut UPU bayi durumu:** 7 tam (yeşil) / 11 yarım (sarı) / 12 yok (kırmızı) / 2 gereksiz (gri)
- **Ana bulgu:** UPU bayi **B2B müşteri portalı** yönünde derin (sipariş + cari + tahsilat + vade + vitrin), **dağıtıcı iç operasyonu** yönünde yüzeysel — saha satış (plasiyer/rota/ziyaret), depo (raf/sayım/seri-lot), satın alma/tedarikçi, fiyat liste hiyerarşisi, ciro primi/iskonto kademesi modülleri yok ya da yarım. Sektörde "dağıtıcı yazılımı" denince ilk akla gelenler bunlar.
- **Öncelikli eksik (faz 1 adayları):** Saha satış (plasiyer/rota/ziyaret), Fiyat liste hiyerarşisi, Satın alma + tedarikçi, Depo (raf + sayım), Ciro primi/hak ediş, Çoklu depo/lokasyon, İade yönetimi.

---

## 1. CORE Modüller (olmazsa olmaz)

Her dağıtım yazılımında 5/5 ürün desteği. Bunlar olmadan "dağıtıcı yazılımı" denmez.

### C1. Cari Hesap (Customer/Vendor Master)
**Ne yapar:** Müşteri (bayi/perakendeci) ve tedarikçi temel kartı: vergi no, adres, sevkiyat adresleri, fatura adresi, ödeme tipi, vade, kredi limiti, iletişim kişileri, segment/grup. Borç-alacak-bakiye merkezi.
**Rol:** Muhasebeci, satış müdürü, yönetici
**Dağılım:** 5/5 (Logo, Mikro, Nebim, NetSuite, SAP B1)
**UPU durumu:** 🟢 TAM — `bayi-cari`, `bayilerim`, `bayi_dealers` (mevcut `dealers` tablo seti, credit limit, audit log dahil)

### C2. Ürün Kataloğu (Product Master / Items)
**Ne yapar:** Ürün kartı: kod, isim, barkod, kategori, marka, KDV oranı, ölçü birimi, görseller, varyant (beden/renk), açıklama. Toplu Excel import.
**Rol:** Ürün müdürü, depocu
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi-urunlerim`, `bayi-urun-ekle`, `bayi-urun-import` (Excel import dahil)

### C3. Sipariş Yönetimi (Order-to-Cash)
**Ne yapar:** Teklif → onay → sipariş → irsaliye → fatura → tahsilat zinciri. Sipariş durum makinesi (beklemede / onaylı / hazırlanıyor / yola çıktı / teslim / iade).
**Rol:** Satış temsilcisi, müdür, bayi
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi-siparis-ver`, `bayi-siparislerim`, `bayilik-siparisleri` (gelen), `bayi_dealer_orders` + items + status_history + shipment alanları. Teklif aşaması yok.

### C4. Fatura ve E-Dönüşüm (Invoicing)
**Ne yapar:** Sipariş üzerinden fatura/irsaliye oluşturma, e-fatura/e-arşiv/e-irsaliye GİB entegrasyonu, iade faturası, ön ödeme/avans faturası.
**Rol:** Muhasebeci
**Dağılım:** 5/5 (TR ürünlerinde GİB entegre, NetSuite/SAP'ta lokalizasyon partneri)
**UPU durumu:** 🟡 YARIM — `bayi-faturalarim`, `bayi_invoices` tablosu var; **e-fatura/e-arşiv GİB entegrasyonu YOK** (sadece kayıt, gerçek belge üretimi yok).

### C5. Stok Yönetimi (Inventory)
**Ne yapar:** Anlık stok seviyesi, kritik eşik uyarısı, manuel giriş/çıkış, hareket geçmişi (movements). Tek depoda da olsa stok kartı + hareketler şart.
**Rol:** Depocu, ürün müdürü
**Dağılım:** 5/5
**UPU durumu:** 🟡 YARIM — `bayi-stok`, `bayi_stock_movements`, `bayi_stock_reservations` var. **Çoklu depo, raf/lokasyon, seri/lot/parti takibi yok.** Tek-depo modelinde çalışıyor.

### C6. Tahsilat (Payments / Collection)
**Ne yapar:** Bayi ödemelerinin kaydı (EFT, nakit, çek/senet, kredi kartı). Dekont yükleme, cari ekstreye işleme, online ödeme (sanal POS).
**Rol:** Muhasebeci, tahsildar, bayi
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi-tahsilatlarim`, `bayi-online-odeme`, `bayi_payments`. Çek/senet portföy yönetimi yarım.

### C7. Vade Takibi (Due Date Management)
**Ne yapar:** Açık faturaların vade tarihine göre listesi, gecikme uyarıları, otomatik hatırlatma (D-3 / D-1 / D-0), kredi limiti aşımı bloğu.
**Rol:** Muhasebeci, tahsildar
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi-vade`, `bayi-vade-hatirlatma`, cron `bayi-vade-reminder`. Hatta sektör ortalamasının üstünde (WA cron entegrasyonu var).

### C8. Genel Muhasebe Entegrasyonu (GL / Accounting Bridge)
**Ne yapar:** Sipariş/fatura/tahsilat hareketlerinin muhasebe fişine dönüşmesi, hesap planına aktarım (Logo/Mikro'da yerleşik, B2B yazılımlarda partner entegrasyonu).
**Rol:** Muhasebeci, mali müşavir
**Dağılım:** 5/5
**UPU durumu:** 🔴 YOK — UPU bayi tek başına muhasebe yazılımı değil; ama "Logo/Mikro/Paraşüt'e CSV/API export" dahi yok. Bağımsız dağıtıcı operasyonu için kabul edilebilir; üst-pazara çıkarsa şart.

---

## 2. OPERASYONEL Modüller

3-5/5 ürün desteği. Bir dağıtıcının günlük işini ciddi hızlandıran modüller.

### O1. Saha Satış / Plasiyer (Field Sales / Mobile SFA)
**Ne yapar:** Plasiyerin mobil cihaz üstünden müşteri ziyaret etmesi, sipariş alması, irsaliye/fatura kesmesi, tahsilat yapması, GPS ile rota takibi.
**Rol:** Saha temsilcisi, bölge müdürü
**Dağılım:** 5/5 (Logo Tiger Mobil Saha Sipariş + Mobil Saha Satış, Mikro CRM saha, Nebim saha, NetSuite mobile sales, SAP B1 mobile SFA). Türkiye'de bağımsız ürün ekosistemi (MobilRut, Evobulut, Ekmob, Acılım Soft) zenginlik göstergesi.
**UPU durumu:** 🔴 YOK — Hiç saha satış akışı yok. Telgrafta "satış temsilcisi" rolü var (capabilities.ts) ama gerçek plasiyer ekranı yok.
**Not:** Sektörde "dağıtıcı yazılımı" denince en sık akla bu gelir. Çağrı'nın dağıtıcı vizyonunda büyük boşluk.

### O2. Rota ve Ziyaret Planlama (Route & Visit Planning)
**Ne yapar:** Plasiyere haftalık ziyaret rotası atama (pazartesi A bölgesi, salı B bölgesi vs.), her müşteri için ziyaret sıklığı, ziyaret raporu (sipariş aldı / almadı / sebep).
**Rol:** Bölge müdürü, plasiyer
**Dağılım:** 5/5
**UPU durumu:** 🔴 YOK — Tamamen yok.

### O3. Sıcak / Soğuk Satış Modu (Van Sales vs Pre-Sales)
**Ne yapar:** **Sıcak satış:** Plasiyer aracında stok var, ziyarette anında satıp irsaliye kesiyor (FMCG/gıda/içecek dağıtımında standart). **Soğuk satış:** Plasiyer sipariş alır, depo ertesi gün sevkiyat yapar.
**Rol:** Plasiyer, depo
**Dağılım:** 4/5 (TR ürünlerinde standart; NetSuite/SAP'ta partner)
**UPU durumu:** 🔴 YOK

### O4. Fiyat Listeleri / Segment Bazlı Fiyat (Price Lists / Tiered Pricing)
**Ne yapar:** Bayi grubuna (A/B/C), bölgeye, ürün kategorisine, miktara göre farklı fiyat listeleri. Geçerlilik tarihi olan kampanya fiyatları. Volume-tier indirim (10+ kutu %5, 50+ kutu %10).
**Rol:** Ürün müdürü, satış müdürü
**Dağılım:** 5/5
**UPU durumu:** 🟡 YARIM — Tek fiyat seviyesi var (ürün kartında bayi fiyatı). Segment/bölge/dönem bazlı çoklu fiyat listesi YOK. `bayi_product_visibility` ürün gösterme/gizleme yapıyor, fiyat değil.

### O5. Kampanya ve Promosyon (Campaigns & Promotions)
**Ne yapar:** Mal fazlası (10+1, 100+15), yüzde indirim, koşullu indirim (sepet ≥1000 TL ise %5), sınırlı süre kampanyası. Otomatik tetikleyici kuralları.
**Rol:** Satış/pazarlama müdürü
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM (görece) — `bayi-kampanya`, `bayi-kampanya-otomatik`, `bayi_campaign_triggers` + `bayi_campaign_executions` tabloları. UPU'nun güçlü tarafı.

### O6. Depo Yönetimi (Warehouse Management / WMS)
**Ne yapar:** Çoklu depo, raf/koridor/lokasyon, mal kabul (irsaliyeden depoya), toplama (picking) listesi, paketleme, sayım, transfer.
**Rol:** Depocu, depo şefi
**Dağılım:** 5/5 (NetSuite WMS, SAP B1 lean WH bin location, Logo/Mikro/Nebim depo modülleri)
**UPU durumu:** 🟡 YARIM — Tek depo + manuel giriş/çıkış var. Çoklu depo, raf, picking, sayım YOK.

### O7. Sevkiyat / Lojistik (Shipment & Logistics)
**Ne yapar:** Siparişin paketten teslimine kadar takibi: kargo/araç plaka kaydı, sürücü ataması, teslim onayı (imza/foto), iade kaydı, tracking no.
**Rol:** Lojistikçi, sürücü, plasiyer
**Dağılım:** 5/5
**UPU durumu:** 🟡 YARIM — `bayi_dealer_order_shipment` alanları var (hazırlandı/yola çıktı/teslim_edildi/iade durum makinesi). Kargo entegrasyonu (Yurtiçi/Aras/MNG API), sürücü atama, teslim foto-imza YOK.

### O8. Satın Alma / Tedarikçi Yönetimi (Procurement)
**Ne yapar:** Tedarikçi siparişi, irsaliye girişi, satın alma faturası, mal kabul → stoğa giriş, tedarikçi cari hesabı. Dağıtıcı kendi ürününü tedarikçiden alır.
**Rol:** Satın alma sorumlusu, ürün müdürü
**Dağılım:** 5/5
**UPU durumu:** 🔴 YOK — `STOCK_PURCHASE` capability var ama gerçek satın alma akışı/tedarikçi cari/satın alma faturası YOK.

### O9. Bildirim Merkezi (Notification Center)
**Ne yapar:** Yeni sipariş, vade yaklaşması, kritik stok, ödeme alındı gibi olayların WA/SMS/email/in-app push'u. Tek panel, çoklu kanal.
**Rol:** Tüm roller (rolüne göre filtre)
**Dağılım:** 3/5 (Logo Tiger 3 portal bildirim, NetSuite/SAP standart, TR rakipler push modülü)
**UPU durumu:** 🟢 TAM — `bayi-bildirimler` + WA fallback + event-driven yapı; UPU'nun üst-pazar üstü tarafı.

### O10. İade Yönetimi (Returns / RMA)
**Ne yapar:** Bayi iade talebi → onay → mal kabul → stoğa giriş → iade faturası → tahsilat geri kaydı. Sebep kodu, miktar, koşul (hasarlı/kullanılmamış).
**Rol:** Müşteri hizmetleri, depocu, muhasebe
**Dağılım:** 5/5
**UPU durumu:** 🔴 YOK — Sipariş statüsünde "iade" var ama gerçek iade akışı/iade faturası YOK.

### O11. Hedef ve Performans (Targets & KPI)
**Ne yapar:** Plasiyer/bölge/ürün bazlı aylık hedef, gerçekleşme, başarı oranı. Bayi başına hedef. Hedef-prim bağlantısı.
**Rol:** Satış müdürü, bölge müdürü
**Dağılım:** 5/5 (Logo "Hedef ve kotalar", Mikro CRM hedef, Nebim sales budget, NetSuite forecast, SAP sales performance)
**UPU durumu:** 🟡 YARIM — `bayi_dealer_scores` skor var ama hedef-gerçekleşme yapısı YOK. Skor "kim aktif" der, "kotaya yaklaştın mı" demez.

### O12. Bölge / Territory Yönetimi
**Ne yapar:** Coğrafi/iller/postakod bölge tanımı, her bayinin bölgeye atanması, plasiyerin bölge sorumluluğu. Bölgeden bayi listesi.
**Rol:** Satış müdürü, bölge müdürü
**Dağılım:** 4/5
**UPU durumu:** 🟡 YARIM — Capabilities'de `VIEW_TERRITORY` izinleri var ama gerçek bölge tablosu, atama UI'ı YOK. Sadece izin modeli hazır.

---

## 3. STRATEJİK Modüller

2-4/5 ürün desteği. Yönetici/CFO seviyesinde değer üretirler.

### S1. Raporlama ve BI (Reporting / Dashboard)
**Ne yapar:** Ciro, kâr marjı, en çok satan ürün, dönem karşılaştırma, bölge/temsilci/bayi kırılımı, Excel/PDF export. Logo Tiger 3 "200+ standart rapor" sayar; NetSuite 200+ rapor + custom builder.
**Rol:** Yönetici, satış müdürü, muhasebeci
**Dağılım:** 5/5
**UPU durumu:** 🟡 YARIM — `bayi-raporlar` (cirolarım) var, export yarım. Sektördeki "rapor üretici / pivot table" derinliği YOK. Çağrı için doğru çünkü AI Eleman'a ileride bu işi devredecek.

### S2. Cari Ekstre / Mizan (Statement of Account)
**Ne yapar:** Borç-alacak-bakiye dökümü, dönemsel filtre, vade analizi (30/60/90 günlük), Excel/PDF dışa aktarım.
**Rol:** Muhasebeci, tahsildar
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi-cari` + ekstre + export var.

### S3. Ciro Primi / Hak Ediş (Volume Rebate)
**Ne yapar:** Bayi belirli ciroyu aşarsa ay/dönem sonu otomatik prim hesabı, fatura ile iade. Logo Netsis'te dedikate akış var; SAP B1 "Sales Rebate" modülü.
**Rol:** Muhasebeci, satış müdürü
**Dağılım:** 4/5 (Logo, Mikro, Nebim, SAP — NetSuite'de partner çözümü)
**UPU durumu:** 🔴 YOK — Türkiye dağıtıcı operasyonunun olmazsa olmaz hesabı. Eksik.

### S4. İskonto Kademeleri / Tier Discounts
**Ne yapar:** Bayi seviyesi (A/B/C/Gold/Silver) × ürün grubuna göre otomatik iskonto, miktar bazlı kademe, dönemsel ek iskonto. O4'le kardeş ama burada **bayinin statüsü** belirleyici, fiyat listesi değil.
**Rol:** Satış müdürü, ürün müdürü
**Dağılım:** 4/5
**UPU durumu:** 🔴 YOK — Capability tanımlı (`ORDERS_DISCOUNT`), backend yok.

### S5. Komisyon / Prim Hesabı (Sales Commission)
**Ne yapar:** Plasiyer/temsilci başına satışa göre komisyon yüzdesi, hedef üzeri ekstra prim, tahsilat sonrası ödeme kuralı.
**Rol:** Muhasebeci, İK
**Dağılım:** 4/5
**UPU durumu:** 🔴 YOK

### S6. Kredi Limiti / Risk Yönetimi (Credit Management)
**Ne yapar:** Bayi başına kredi limiti, limit aşıldığında sipariş bloke, geçici limit artırma onayı, risk skoru.
**Rol:** Muhasebeci/CFO, satış müdürü
**Dağılım:** 5/5
**UPU durumu:** 🟢 TAM — `bayi_dealer_credits`, `bayi_credit_movements`, `bayi_credit_limit_audit`, `DEALERS_CREDIT_LIMIT` capability + `bayi-risk` UI (`churn risk` + recovery aksiyonu). Güçlü taraf.

### S7. Talep Tahmini / Forecasting (Demand Forecasting)
**Ne yapar:** Geçmiş satışa + mevsimsellik + lead-time'a göre önümüzdeki aylar talep tahmini, sipariş önerisi, stok seviyesi optimizasyonu.
**Rol:** Ürün müdürü, satın alma
**Dağılım:** 3/5 (NetSuite AI-supported forecasting, SAP demand mgmt, Logo MRP — Mikro/Nebim daha hafif)
**UPU durumu:** 🔴 YOK (S7'nin AI versiyonu D1'de)

### S8. Müşteri Sadakat / CRM (Loyalty / CRM)
**Ne yapar:** Bayi davranış analizi, segmentasyon, drip pazarlama, kampanya kişiselleştirme, churn tahmini.
**Rol:** Pazarlama
**Dağılım:** 4/5 (Logo CRM, Mikro CRM, Nebim CRM, NetSuite CRM, SAP CRM)
**UPU durumu:** 🟢 TAM — `bayi-marketing` (drip), `bayi_drip_campaigns/steps/sends/enrollments`, `bayi_dealer_scores`, churn risk, `bayi-oneriler`. Sektör ortalamasının üstünde.

---

## 4. İLERİ / AI Modüller

0-2/5 ürün desteği. Çoğunluk için "olsa iyi" ama UPU'nun ana farklılaşma alanı (AI Eleman roster ile uyumlu).

### D1. AI Talep Tahmin + Otomatik Satın Alma Önerisi
**Ne yapar:** Talep tahmininin ML'li versiyonu. Hangi ürünü hangi haftaya kadar kaç adet sipariş etmeli — otomatik öneri (ürün müdürü onaylar).
**Dağılım:** 1/5 (NetSuite AI demand forecasting)
**UPU durumu:** 🔴 YOK (Ürün müdürü AI Eleman'ı için doğal görev)

### D2. Cross-sell / Up-sell Önerisi
**Ne yapar:** "Bu bayi şu ürünü hep alıyor, bunu da öner" — sipariş ekranında AI önerisi.
**Dağılım:** 0/5 standart, partner çözümleri var
**UPU durumu:** 🟢 TAM — `bayi-cross-sell`, `bayi_cross_sell_pairs`, `recommendations.ts`, `recommendation_rules/runs`, cron `bayi-recommendations`. UPU'nun **rakipler üstü tarafı**, koru.

### D3. Online Vitrin / Mini E-ticaret (Dealer Storefront)
**Ne yapar:** Her bayi için tek-tık oluşan müşteri-yüzlü vitrin/landing — son tüketicinin bayiyi bulması, talep göndermesi.
**Dağılım:** 1/5 (Nebim e-ticaret tarafında; diğerleri partner)
**UPU durumu:** 🟢 TAM — `bayi-vitrinim`, `bayi-musteri-talepleri`, `bayi_vitrines`, `bayi_leads`. Çağrı'nın özgün kararı; sektörde yok.

### D4. AI Eleman Roster (Multi-Persona Assistant)
**Ne yapar:** Tek chatbot DEĞİL — Kurucu/Yönetici/Eğitmen gibi rol-bazlı asistan ekibi. Her birinin yetki farkındalığı var.
**Dağılım:** 0/5 (Hiçbirinde yok)
**UPU durumu:** 🟢 TAM (vizyon olarak) — `src/tenants/bayi/agents/` (`bayi-upu.ts`, `conversational.ts`, setup-flows). Tamamen UPU'ya özgü.

---

## 5. Ürün Karşılaştırma Tablosu

| Modül | Logo Tiger 3 | Mikro Fly | Nebim V3 | NetSuite | SAP B1 |
|---|---|---|---|---|---|
| **CORE** | | | | | |
| C1 Cari | ✓ | ✓ | ✓ | ✓ | ✓ |
| C2 Ürün katalog | ✓ | ✓ | ✓ | ✓ | ✓ |
| C3 Sipariş | ✓ | ✓ | ✓ | ✓ | ✓ |
| C4 Fatura/e-dönüşüm | ✓ TR | ✓ TR | ✓ TR | partner | partner |
| C5 Stok | ✓ | ✓ | ✓ | ✓ | ✓ |
| C6 Tahsilat | ✓ | ✓ | ✓ | ✓ | ✓ |
| C7 Vade | ✓ | ✓ | ✓ | ✓ | ✓ |
| C8 GL muhasebe | ✓ | ✓ | ✓ | ✓ | ✓ |
| **OPERASYONEL** | | | | | |
| O1 Saha satış | ✓ Mobil | ✓ CRM saha | ✓ | ✓ mobile | ✓ SFA |
| O2 Rota/ziyaret | ✓ | ✓ | ✓ | ✓ | ✓ |
| O3 Sıcak/soğuk satış | ✓ | ✓ | ~ | partner | partner |
| O4 Fiyat listeleri | ✓ | ✓ | ✓ | ✓ | ✓ |
| O5 Kampanya/promosyon | ✓ | ✓ | ✓ | ✓ | ✓ |
| O6 Depo (raf/lokasyon) | ✓ | ✓ | ✓ raf | ✓ WMS | ✓ bin |
| O7 Sevkiyat/lojistik | ✓ | ✓ | ✓ | ✓ | ✓ |
| O8 Satın alma | ✓ | ✓ | ✓ | ✓ | ✓ |
| O9 Bildirim merkezi | ~ portal | ~ | ~ | ✓ | ✓ |
| O10 İade | ✓ | ✓ | ✓ | ✓ | ✓ |
| O11 Hedef/KPI | ✓ | ✓ | ✓ | ✓ | ✓ |
| O12 Bölge/territory | ✓ | ✓ | ✓ | ✓ | ~ |
| **STRATEJİK** | | | | | |
| S1 Rapor/BI | ✓ 200+ | ✓ | ✓ | ✓ 200+ | ✓ |
| S2 Cari ekstre | ✓ | ✓ | ✓ | ✓ | ✓ |
| S3 Ciro primi | ✓ Netsis | ✓ | ~ | partner | ✓ Rebate |
| S4 İskonto kademe | ✓ | ✓ | ✓ | ✓ | ✓ tier |
| S5 Komisyon/prim | ✓ | ✓ | ~ | ✓ | ✓ |
| S6 Kredi limit/risk | ✓ | ✓ | ✓ | ✓ | ✓ AR |
| S7 Talep tahmin | ~ MRP | ~ MRP | ~ | ✓ AI | ✓ |
| S8 CRM/sadakat | ✓ CRM | ✓ CRM | ✓ CRM | ✓ | ✓ |
| **İLERİ/AI** | | | | | |
| D1 AI demand fcst | – | – | – | ✓ AI | – |
| D2 Cross-sell AI | – | – | – | partner | – |
| D3 Online vitrin | – | – | ~ | – | – |
| D4 Multi-persona AI | – | – | – | – | – |

Açıklama: ✓ = standart modül / ~ = kısmi veya partner çözümü / – = yok.

---

## 6. UPU Bayi GAP Tablosu

| Modül | UPU Durumu | Mevcut Karşılık | Öneri |
|---|---|---|---|
| C1 Cari | 🟢 TAM | bayi-cari, bayilerim, dealers + credit | — |
| C2 Ürün katalog | 🟢 TAM | bayi-urunlerim, import | — |
| C3 Sipariş | 🟢 TAM | siparis-ver, dealer_orders, status history | Teklif aşaması eklenebilir |
| C4 Fatura/e-dönüşüm | 🟡 YARIM | bayi-faturalarim, bayi_invoices | **GİB e-fatura/e-arşiv/e-irsaliye entegrasyonu** (faz 2 önceliği) |
| C5 Stok | 🟡 YARIM | bayi-stok, stock_movements, reservations | Çoklu depo + raf + seri/lot (faz 1-2) |
| C6 Tahsilat | 🟢 TAM | tahsilatlarim, online-odeme | Çek/senet portföyü (faz 2) |
| C7 Vade | 🟢 TAM | vade + cron + WA | — |
| C8 GL muhasebe | 🔴 YOK | — | En azından **Paraşüt/Logo/Mikro export API** (faz 3) |
| O1 Saha satış | 🔴 YOK | — | **Faz 1 ana modül** — mobil web/PWA değil, gerçek mobil akış |
| O2 Rota/ziyaret | 🔴 YOK | — | **Faz 1** O1 ile birlikte |
| O3 Sıcak/soğuk satış | 🔴 YOK | — | Faz 2 (O1 oturduktan sonra) |
| O4 Fiyat listeleri | 🟡 YARIM | tek fiyat | **Faz 1** — segment/bölge/dönem fiyat listesi |
| O5 Kampanya | 🟢 TAM | kampanya, kampanya-otomatik, triggers | — |
| O6 Depo (raf) | 🟡 YARIM | tek depo | Faz 2 — çoklu depo + raf |
| O7 Sevkiyat | 🟡 YARIM | shipment status alanları | Faz 2 — kargo API (Yurtiçi/Aras/MNG), teslim foto |
| O8 Satın alma | 🔴 YOK | capability stub | **Faz 1** — tedarikçi cari + satın alma faturası |
| O9 Bildirim merkezi | 🟢 TAM | bayi-bildirimler + WA fallback | — |
| O10 İade | 🔴 YOK | sipariş statüsünde "iade" var | Faz 2 — gerçek iade akışı + fatura |
| O11 Hedef/KPI | 🟡 YARIM | dealer_scores skor | **Faz 1** — hedef tanımı + gerçekleşme + komisyon hook'u |
| O12 Bölge | 🟡 YARIM | capability izinleri | Faz 1 — bölge tablosu + atama UI |
| S1 Rapor/BI | 🟡 YARIM | bayi-raporlar (cirolarım) | Faz 2 — pivot/Excel export derinleştir |
| S2 Cari ekstre | 🟢 TAM | bayi-cari export | — |
| S3 Ciro primi | 🔴 YOK | — | **Faz 1** — TR dağıtıcı standardı, eksik |
| S4 İskonto kademe | 🔴 YOK | capability stub | Faz 1 — O4 ile kardeş |
| S5 Komisyon | 🔴 YOK | — | Faz 2 (O11 oturduktan sonra) |
| S6 Kredi limit | 🟢 TAM | dealer_credits + audit | — |
| S7 Talep tahmin | 🔴 YOK | — | Faz 3 — D1 AI olarak |
| S8 CRM/sadakat | 🟢 TAM | marketing, drip, oneriler, churn risk | — |
| D1 AI demand fcst | 🔴 YOK | — | Faz 3 — Ürün Müdürü AI Elemanı görevi |
| D2 Cross-sell AI | 🟢 TAM | recommendations + cron | — |
| D3 Online vitrin | 🟢 TAM | vitrinim + leads | — |
| D4 Multi-persona AI | 🟢 TAM | agents/ roster | — |
| **GEREKSİZ?** | | | |
| ⚪ Drip marketing → bayi'ye | ⚪ | bayi-marketing tüm bayi listesine drip | Dağıtıcı operasyonunda "bayi'ye drip" SaaS pazarlama tarzı; gerçek dağıtıcı için fazla. Kampanya tetikleyici (O5) ile birleştirilebilir, ayrı modül olarak şişmesin. |
| ⚪ Referral (davet ödülü) | ⚪ | referral_codes + referrals + credits | B2B dağıtıcı operasyonunda bayi-bayiyi-davet etmez (bölge çakışır). Pazarlama kanalı olarak duruyor ama core değil. |

---

## 7. Önerilen Sıralama (faz mantığı)

### Faz 1 — "Gerçek Dağıtıcı" temelleri (CORE eksikleri + en kanlı operasyon gap'leri)
**Hedef:** UPU bayi'yi "B2B müşteri portalı" değil, "dağıtıcı yazılımı" yapan modüller.

1. **O1 + O2 Saha satış + Rota/ziyaret** — Plasiyer mobil ekranı (PWA değil, dedikate mobil akış). Bu olmadan dağıtıcı yazılımı denmez.
2. **O4 + S4 Fiyat listeleri + İskonto kademeleri** — Segment bazlı fiyat. Her bayi A/B/C kategoride farklı fiyat görür.
3. **O8 Satın alma + tedarikçi** — Stok arkadan giriyor; bu yoksa stok hep sıfırdan başlıyor.
4. **S3 Ciro primi / hak ediş** — TR pazarında olmazsa olmaz hesap.
5. **O11 + O12 Hedef + Bölge** — Plasiyer hedefi olmadan saha satışı eksik kalır.

### Faz 2 — Operasyonel olgunluk
6. **C4 e-Fatura/e-Arşiv/e-İrsaliye GİB entegrasyonu** — Şu an "kayıt" var, gerçek belge yok.
7. **C5 + O6 Çoklu depo + raf/lokasyon + sayım** — Birden fazla deposu olan dağıtıcı için.
8. **O7 Sevkiyat: kargo API + teslim foto/imza** — Yurtiçi/Aras/MNG entegrasyonu.
9. **O10 İade yönetimi** — Sebep kodu, iade faturası, stoğa geri.
10. **O3 Sıcak/soğuk satış modları** — Saha satış oturduktan sonra.
11. **S1 Rapor derinleştirme** — Pivot, export, dönem karşılaştırma.
12. **S5 Komisyon hesabı** — Hedef oturduktan sonra.
13. **C5 Seri/Lot/Parti takibi** — Gıda/ilaç dağıtıcısı için kritik (sektör genişleyince).

### Faz 3 — AI Eleman'a uygun stratejik katman
14. **D1 AI talep tahmin → Ürün Müdürü AI Eleman görevi** — Demand forecast LLM destekli.
15. **S7 standart forecasting** (D1'in deterministic versiyonu, AI yedeği).
16. **C8 Muhasebe export API** (Paraşüt/Logo/Mikro entegrasyonu).
17. **Çek/senet portföyü** (C6 derinleştirme).

### Temizlenebilir (önce sorulmadan dokunma — Çağrı kararı)
- ⚪ Drip marketing'in bayi-listesine drip akışı: kampanya tetikleyici (O5) içine emil. Ayrı menü olarak şişmesin.
- ⚪ Referral kredisi: B2B dağıtıcıda anlamı azaldığından, alt-tenant pazarlama tarafına taşı veya gizle.

---

## 8. Kullanılan Kaynaklar

**Türk dağıtım yazılımları:**
- Logo Tiger 3 Enterprise — [logo.com.tr ürün sayfası](https://www.logo.com.tr/en/product/logo-tiger-3-enterprise)
- Logo Tiger 3 Satış ve Dağıtım modülü — [antsoft.com.tr](https://www.antsoft.com.tr/logo-tiger-3/logo-tiger-3-satis-ve-dagitim-modulu/)
- Logo Mobil Saha Sipariş — [logo.com.tr ecosystem](https://www.logo.com.tr/en/logo-ecosystem-solutions/tiger-mobile-field-order)
- Logo Saha Satış Otomasyonu (Reset Bilişim) — [resetyazilim.com](https://www.resetyazilim.com/blog/logo-saha-satis-otomasyonu.html)
- Logo Plasiyer Rota/Hedef — [logouzakdestek.com](https://www.logouzakdestek.com/single-post/)
- Mikro Fly — [mikro.com.tr ERP programları](https://www.mikro.com.tr/erp-programlari/), [dbt.com.tr Mikro Fly](https://www.dbt.com.tr/mikrofly), [teknoerp.com.tr](https://www.teknoerp.com.tr/mikro-fly)
- Mikro Hızlı Saha Satış / Plasiyer — [mikroavcilar.com](https://www.mikroavcilar.com/mikro-cozumler.php?sayfa=hizli-saha-satisi-ve-plasiyer-yazilimi)
- Nebim V3 genel + uygulamalar — [nebim.com.tr overview](https://www.nebim.com.tr/en/nebim-v3-overview), [nebim.com.tr applications](https://www.nebim.com.tr/en/nebim-v3-applications)

**International referans:**
- NetSuite Wholesale Distribution — [netsuite.com](https://www.netsuite.com/portal/industries/wholesale-distribution-accounting.shtml)
- NetSuite WSD 10 features (Ceba Solutions) — [cebasolutions.com](https://www.cebasolutions.com/blog-posts/the-top-10-features-of-netsuite-wholesale-distribution-edition)
- SAP Business One Wholesale — [silvertouchinc.com](https://www.silvertouchinc.com/blog/sap-business-one-the-key-to-wholesale-distribution-success/), [zyplesoft.com](https://www.zyplesoft.com/wholesale/)

**TR saha satış ekosistemi (sektör derinliği referansı):**
- MobilRut — [mobilrut.com saha satış programı](https://www.mobilrut.com/saha-satis-programi/)
- Evobulut — [evobulut.com saha satış](https://www.evobulut.com/saha-satis-programi)
- Acılım Soft — [acilimsoft.com](https://acilimsoft.com/mobil-saha-satis-programi/)
- Ekmob SFA bayi ağı blog — [ekmob.com](https://ekmob.com/blog/perakende-ve-bayi-agi-olan-firmalarda-saha-ekip-yonetimi/)
- Opsen plasiyer tanımı — [useopsen.com](https://useopsen.com/plasiyer)

**Ciro primi / hak ediş referansı:**
- Logo Netsis dönem sonu ciro hak ediş — [docs.logo.com.tr](https://docs.logo.com.tr/pages/viewpage.action?pageId=22805187)
- Logo Netsis Ek-4 ciro primi — [docs.logo.com.tr Ek-4](https://docs.logo.com.tr/pages/viewpage.action?pageId=100673469)

**Trade promotion / rebate (uluslararası):**
- Syspro Trade Promotions — [syspro.com](https://www.syspro.com/product/trade-promotions/)
- Oracle Channel Revenue Mgmt — [oracle.com SCM](https://www.oracle.com/scm/order-management/channel-revenue-management/)

**Distribution ERP feature derlemeleri:**
- Bizowie distribution ERP guide — [bizowie.com](https://bizowie.com/distribution-erp-software-the-complete-guide-for-wholesale-and-distribution-companies)
- ERP Research best ERP 2026 — [erpresearch.com](https://www.erpresearch.com/en-us/best-erp-software-wholesale-distribution)

**UPU bayi mevcut kod (gap analizi için doğrudan okundu):**
- `src/tenants/bayi/capabilities.ts` (40 capability + 8 pozisyon preset)
- `src/tenants/bayi/components/sidebar.ts` (37 sidebar item)
- `src/app/[locale]/(bayipanel)/` (37 sayfa dizini)
- `src/app/api/bayi-*/` (40+ API endpoint)
- `supabase/migrations/*bayi*` (15 migration, 24 tablo)
- `src/tenants/bayi/CLAUDE.md`, `src/tenants/bayi/agents/`
