# Emlak Tenant — Current-State UX Audit
**Tarih:** 2026-04-20
**Amaç:** Gerçek kodda var olan her ekran, CTA, nav, dead-end, eksik — tek doküman. Hepsini tek commit ile kapatmak için gap listesi.

---

## Platform Sınırlamaları (Her Yerde Uyulması Gereken)

- WhatsApp button: **max 3**, title **max 20 char**
- WhatsApp list: **max 10 rows total**, row title **max 24 char**, button label **max 20 char**, body **max 1024 char**
- WhatsApp text message: max **4096 char** (4000 safe)
- Callback_data: max **~100 bytes** (WhatsApp limit)

## UX İnvariantları (Her Ekran için Kural)

1. **Tek primary CTA**: Her aksiyon ekranı TEK başat butona sahip olmalı (çoklu seçim listelerinde istisna)
2. **Her ekranda nav**: Primary mesajından sonra ayrı mesajda `[▶️ Göreve Devam | 🏠 Ana Menü]`
3. **Dead-end yok**: Bot cevap verdiği HER yerde kullanıcı devam edebilmeli. Text-only "✅ eklendi" feedback'i sonrası asla durmamalı
4. **"menu" / "devam" her yerden çalışır**: Text olarak yazarsa session bypass edilir
5. **Session TTL 12 saat**: Yarım kalan işler kaybolmaz
6. **Uzun text otomatik parçalanır**: 4096+ karakter sendText splitForWhatsApp ile 3900'e bölünür

---

## FAZ A — İlk Temas + Onboarding

### A1 — İnvite / Hoş Geldin
- Komut: yok (davet linki tıklama / ilk mesaj)
- Tetik: /api/whatsapp route.ts → startIntro çağırıyor
- **Durum**: ✅ çalışıyor

### A2 — İntro Mesajı + "Bölge Seç" Listesi
- Kaynak: intro.ts:startIntro
- Content: Uzun hoş geldin metni (asistan neler yapabilir) + `Bölge Seç` list (Bodrum sadece)
- Session: artık `_intro / region` olarak açılıyor (fix: commit ff0a06f)
- **Nav**: auto-append ✓
- **Gap**: sadece "Bodrum" seçeneği var, diğer şehirler yok (ileride eklenecek)

### A3 — Mülk Tipi (list: Villa/Daire/Arsa/Müstakil/Rezidans/Dükkan/Büro Ofis/Hepsi)
- vf:region:X → type list → session: `type`
- **Nav**: auto-append ✓
- **Gap**: (yok)

### A4 — Satılık/Kiralık (buttons: Satılık/Kiralık/Hepsi)
- vf:type:X → listing buttons → session: `listing`
- **Nav**: auto-append ✓
- **Gap**: Hepsi var, button maxı olsaydı sorun olurdu, şimdi OK

### A5 — Kimin İlanları (buttons: Sahibinden/Emlak Ofisinden/Hepsi)
- vf:listing:X → listed buttons → session: `listed`
- **Nav**: auto-append ✓
- **Gap**: (yok)

### A6 — Özet Rapor + "🚀 Devam Et"
- vf:listed:X → uzun rapor text + Devam Et button
- **Uzun metin fix'lendi** (commit aafaef6): sendText + ayrı sendButtons
- **Nav**: auto-append ✓
- **Gap**: (yok)

### A7 — Onboarding Form (profil bilgileri)
- vf:start → initOnboarding → sendOnboardingStep
- Adım adım: display_name → office_name → email → phone → location → experience_years → save
- Her step sendText + sonraki step
- **Durum**: ⚠️ Her step'te nav yok (sendText alone)
- **Gap (A7-FIX)**: onboarding.ts sendOnboardingStep sonrası sendNavFooter çağrılmalı

### A8 — Discovery Chain / Intro Sonu
- startDiscoveryChain → setup tamamlandı mesajı + "🏠 Mülk Ekle" button
- **Nav**: sendButtons auto-append ✓
- **Gap**: (yok)

---

## FAZ B — Ana Menü

### B1 — /menu veya "Ana Menü" click
- showMenu: 2 sendList (Komutlar + Sistem Menüsü) — skipNav ilkinde, nav ikincide
- **Durum**: ✅ (commit e0097c4 tek nav)
- **Gap**: (yok)

### B2 — Sistem Menüsü → Web Panel
- handleWebpanelShared: magic link text + nav footer (commit 8608a53)
- **Durum**: ✅
- **Gap**: (yok)

### B3 — Sistem Menüsü → Profilim
- showProfile: profil bilgisi text + button ("Düzenle" / "Menü")
- **Nav**: sendButtons auto-append ✓
- **Gap**: (yok)

### B4 — Sistem Menüsü → Kılavuz / Hakkımızda / Uzantı / Değiştir
- Hepsi sendButtons ile son ekran
- **Nav**: auto-append ✓

---

## FAZ C — /mulkekle (Ana Feature)

### C1 — Mülk Ekle Menüsü
- handleMulkEkleMenu: "Nasıl eklemek istersiniz?" + 2 button: Sahibinden linki / Manuel ekle + tip metni
- **Nav**: auto-append ✓
- **Gap**: (yok)

### C2 — "Sahibinden Linki" Flow

**C2.1 — Link ister**
- handleTara: sendText "🔍 Portal linkini yapıştırın" + sendText örnek
- Session: `tara / waiting_url`
- **Gap (C2.1-FIX)**: sendText iki kez, nav yok → tek sendText + sendNavFooter
- **Gap (C2.1-FIX)**: "iptal" / "menu" zaten çalışıyor ama visual cue yok

**C2.2 — URL işleniyor (scrape)**
- processPortalUrl → resolveShortUrl (shbd.io → sahibinden) → scrape
- "🔍 İlan bilgileri çekiliyor..." sendText
- ScrapingBee 8s timeout
- **Durum**: ✅ (commit 73448b5)
- **Gap**: Vercel Hobby 10s limit sıkı — Pro'ya geçmeden timeout ile kaybederiz

**C2.3 — Sonuç özeti + primary CTA**
- Scrape başarılı (fiyat+m² var) → "📊 Sunumu Hazırla" tek button
- Eksik → "✏️ Tamamla" tek button
- Fotolar: scrape edilen 10 resim DB'ye
- **Nav**: auto-append ✓
- **Gap (C2.3-FIX)**: "Tamamla" şu an mulkdetay'a (full edit formu) yönlendiriyor. Kullanıcı istediği: sunum için minimum alanları (fiyat, m², oda) sırayla sor → bitince "Sunumu Hazırla"

### C3 — "Manuel Ekle" Flow (handleMulkEkle)

**Çok uzun — ~30 step. Fazlar:**

Faz 1: Temel (title → price → m² → net_m² → rooms → listing_type → city → district → neighborhood)
Faz 2: Bina (floor → totalfloors → buildingage → heating → parking → facade → deed → housing → usage → swap)
Faz 3: İç mekan (bathroom → kitchen → elevator → balcony)
Faz 4: Özellikler (intfeat → extfeat → viewfeat → muhit → engelli → transport) — multi-select, sayfalı
Faz 5: Açıklama (desc_choice: AI/Manuel/Geç → ai_desc_review)
Faz 6: Finalize (finalize:ok → DB insert → success message)

**Nav durumu**:
- Her select/list ekranında nav auto-append ✓
- Text input ekranlarında (title, price, city, etc.) sendText alone → nav YOK
- **Gap (C3-FIX)**: Her text-input prompt sonrası sendNavFooter (ya da "iptal" butonu)

**Dead-end riskleri**:
- Fiyat geçerli değilse "geçerli fiyat yazın" text, nav yok — **gap**
- m² geçersizse aynı — **gap**

---

## FAZ D — /sunum (Sunum Hazırla)

### D1 — Müşteri Seç
- handleSunum: eğer müşteri yoksa → "Müşteri Ekle / Menü" button
- Varsa → müşteri listesi
- **Nav**: auto-append ✓

### D2 — Mülk Seç (multi)
- Müşteri seçildikten sonra → mülk listesi
- Multi-select toggle pattern (eslestir'e benzer)
- **Nav**: auto-append ✓

### D3 — Eksik Bilgi Kontrolü
- Seçilen mülklerde eksik varsa → "Şu alanlar eksik, doldurayım mı?"
- fill_customer_info / fill_property_info session
- **Gap (D3-FIX)**: bu akış tam test edilmedi, dead-end riski var

### D4 — AI Sunum Generate + Link
- generatePresentation → magic link
- **Yeni fix (commit 81dc9c5)**: Link mesajı + AYRI customer message template
- **Nav**: link mesajı skipNav:true + template sendText (nav yok) → **Gap (D4-FIX)**: template sonrası sendNavFooter lazım

### D5 — Müşteriye Gönder
- snm:send → WhatsApp'tan direkt müşteriye gönder
- Başarı mesajı + "Sonraki: başka müşteri / hatırlatma" gibi CTA — mevcut CTA yok, **Gap (D5-FIX)**

---

## FAZ E — Diğer Killer Komutlar (Hızlı Tarama)

### E1 — /fiyatbelirle
- handleFiyatBelirle: mülk seç → AI fiyat önerisi
- **Gap**: incelenmedi, audit gerekli

### E2 — /musteriEkle
- handleMusteriEkle: adım adım müşteri kaydı (PROPERTY_TYPE_OPTIONS multi-select, rooms, budget, location)
- Zaten multi-select fix'lendi daha önce
- **Gap**: audit gerekli (muhtemelen text step'lerde nav yok)

### E3 — /eslestir
- handleEslestir: müşteri seç → uyumlu mülkleri listele
- **Gap**: audit gerekli

### E4 — /musteriTakip
- Takip görevleri
- **Gap**: audit gerekli

### E5 — /musteriDuzenle, /musterilerim
- Detay ekranları
- **Gap**: audit gerekli

### E6 — /hatirlatma
- Hatırlatma kurma (date picker var mı? text mi?)
- **Gap**: audit gerekli

### E7 — /takipEt
- sahibinden ilan sahibiyle iletişim (owner contact)
- **Gap**: audit gerekli

### E8 — /satistavsiye
- AI satış tavsiyesi
- **Gap**: audit gerekli

### E9 — /fotograf, /paylas, /yayinla, /websitem
- Medya komutları
- **Gap**: audit gerekli

### E10 — /sozlesme, /sozlesmelerim
- Sözleşme üretimi (PDF?)
- **Gap**: audit gerekli

### E11 — /tara, /ekle
- Portal URL ile ekleme (tara = C2 aynı)

### E12 — /ipucu
- Tips system
- **Gap**: tıklayınca ne oluyor audit gerekli

---

## ÖNCELİKLİ FIX LİSTESİ (Tek Commit)

### 🔥 Kritik (Dead-end önleme)
1. **A7-FIX**: Onboarding form adımları sendText-only → sendNavFooter ekle
2. **C2.1-FIX**: handleTara "URL yapıştırın" ekranına nav footer
3. **C3-FIX**: handleMulkEkleStep her text prompt sonrası sendNavFooter
4. **C3-VAL**: Validation hatalarında ("geçerli fiyat", "m² geçersiz") nav footer
5. **D4-FIX**: Sunum customer template sonrası sendNavFooter
6. **D5-FIX**: Müşteriye gönder başarı mesajı sonrası sendNavFooter + "sonraki görev" CTA

### 🎯 UX İyileştirme (User's specific asks)
7. **C2.3-FIX**: "Tamamla" → sunum için minimum alan flow'u (yeni handler: handleTamamla)
   - Gerekli alanlar: fiyat, m², oda (yoksa soru), title (yoksa), konum (yoksa)
   - Foto yoksa 3+ foto iste
   - Hepsi dolunca "Sunumu Hazırla" button
8. **D5-NEXT**: Sunum gönderildikten sonra "Sonraki görev" flow'u (örn. "3 gün sonra takip hatırlatması")

### 🔧 Audit Gerekli (Sonra)
- E1-E12: hepsinin tek tek incelemesi, nav eksiklerini tespit

### 📋 Tenant Bazında Planla (Sonra)
- bayi: C# aynı pattern
- muhasebe, otel, siteyonetim: ayrı flow'lar, ayrı haritalar

---

## Uygulama Yol Haritası

**Oturum 1 (şimdi):** 🔥 kritik 6 fix + 🎯 C2.3-FIX (Tamamla flow). Tek commit.
**Oturum 2:** D5-NEXT + audit round 1 (E1-E6)
**Oturum 3:** audit round 2 (E7-E12)
**Oturum 4:** bayi tenant map + bayi implementation
**Oturum 5 +:** muhasebe/otel/siteyonetim
