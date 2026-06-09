# Milestone: B2B Portal MVP

> **Başlangıç:** 2026-06-09
> **Hedef bitiş:** ~3-4 hafta dolu çalışma
> **Karar dayanağı:** Çağrı 2026-06-09 — bayi SaaS'ı tek bir net iş yapmak üzere yeniden konumlandırıyoruz: dağıtıcı–bayi B2B portalı. Bunu **5 yıldızlı** bitireceğiz. Bunun dışında kalan modüller (muhasebe, e-fatura, kargo, ödeme detayları) **dışarıdan API ile** alınacak (Logo, Foriba, Aras, iyzico).

---

## 1. Konum

- **Hedef kitle:** 5–50 bayisi olan küçük-orta TR dağıtıcısı. Sektör: gıda, kozmetik, tekstil, elektronik, yapı. NextTrack benzeri ürünleri **alamayacak** segment.
- **Konumlanma:** "Küçük dağıtıcının NextTrack'i — **WhatsApp-first + AI Eleman farkıyla**."
- **Dışarıdan API ile alınacak:** muhasebe (Logo/Mikro/Paraşüt), e-fatura (Foriba/Mikrohizmet), ödeme (iyzico/Mollie), kargo (Aras/Yurtiçi/MNG). Kendi yazmıyoruz, **bağlanıyoruz**.

## 2. End State (Çağrı 2026-06-09 onayı)

### Dağıtıcı (Mehmet Bey, gıda toptancısı) bir sabah

- 09:00 portal'ı açar. Dashboard: dün 47 sipariş, 312k₺ ciro, 3 bayi kredi limitini aşmış, Ahmet Plasiyer 18 ziyaret yapmış.
- AI Eleman'a sorar: "Bu hafta hangi bayi gecikmeye girdi?" → liste alır.
- Yeni kampanya tanımlar: "30 koli al 35 koli öde, sadece A-segment bayiye, 1 hafta süreli". Yayınla → A-segment bayilere WA bildirim.
- Sipariş onay kutusunu görür, 3 büyük siparişi onaylar.

### Bayi (Ayşe Hanım, market sahibi) aynı gün

- WA'dan dün gece bildirim almış: *"Yeni kampanya: 30 al 35 öde. Görüntüle 🛒"*. Linke tıklar.
- Portal'a kayıt yoksa **WA OTP signup**, varsa direkt giriş.
- Bayi-özel ana sayfa: kampanya öne, son siparişler, favori ürünler.
- "Tekrar sipariş" tek-tık → geçen haftanın siparişini bir tıkla tekrarlar.
- Sepet → checkout (kart veya açık hesap).
- Sipariş onaylandı → WA bildirim: *"Siparişiniz onayda. Tahmini teslim: salı"*.
- Salı sabah WA bildirim: *"Kargonuz çıktı, Aras takip no: ABC123"*.
- Cuma WA bildirim: *"Bu ay vadenizden 15.000₺ ödemeniz yaklaşıyor. 3 gün kaldı. Şimdi öde 💳"*.

### Arka planda

- Logo Tiger'dan ürün/stok/fiyat/bayi günlük cron + webhook ile senkron.
- Sipariş onaylanınca Foriba'ya e-Fatura çağrısı düşer, fatura PDF bayiye WA'dan gider.
- AI Eleman Mehmet Bey'in sorularını cevaplar; cross-sell önerisi sipariş alırken bayiye "bunu da alır mısın?" gösterir.

---

## 3. Auth (Çağrı 2026-06-09 onayı)

- **Primary:** WA OTP (signup + login).
- **Add-on (signup sonrası):** Google hesabı bağla — alternatif login. Profil → "Hesabımı bağla" sekmesinden. Altyapı mevcut (`/api/auth/google/*`), sadece yeniden konumlanacak.

## 4. WA Bildirimleri (Çağrı 2026-06-09 onayı)

**Dağıtıcı → Bayi yönü:**
1. Hoşgeldin (signup)
2. Yeni kampanya geldi
3. Sipariş alındı / onaylandı / iptal edildi
4. Kargo çıktı + takip no
5. Vade yaklaştı (3 gün / 1 gün önce)
6. Vade geçti (geciken)
7. Yeni fatura kesildi (PDF link)
8. Kredi limit uyarısı (yaklaşırken)
9. Bakiye hatırlatma (aylık)
10. Ödeme alındı (teşekkür)

**Dağıtıcı kendine yönelik:**
11. Yeni sipariş geldi (büyük ise eşik)
12. Sipariş onay bekliyor
13. Kritik stok uyarısı
14. Gecikmiş bayi günlük rapor

---

## 5. Fazlar

> Her faz **küçük adımlara** bölünür (Ford prensibi). Her faz sonunda **canlı + Çağrı testi** zorunlu. "Tamamlandı" raporu için "Atla" + "Kaydet" yolları dahil **gerçek UI tıklama testi** şart (sadece cURL/API doğrulama yetmez).

### Faz 0 — Temizlik (1 gün)

**Hedef:** Mevcut bayi panel'inde "yanlış konumlu" / "yarım kalmış" menüleri **gizle** (silme değil, feature flag arkasına al). Omurga MVP'ye odaklan.

- [ ] Feature flag mekanizması (env veya DB) — yoksa kur
- [ ] Gizlenecek menüler: Cross-sell motoru, Marketing auto, Referans sistemi, Online Vitrin (V2'ye)
- [ ] Mevcut sipariş + cari + vade + tahsilat akışını "B2B Portal MVP" iskeleti altına yeniden organize et
- [ ] Eski test/ölü kod taraması (kullanılmayan endpoint, eski hero kartları, demo veri)
- [ ] AÇIK-İŞLER.md güncelleme: hangi parçalar arşivlendi, neden

### Faz 1 — Dağıtıcı (satıcı) tarafı (3-4 gün)

**Hedef:** Mehmet Bey end state'i: dashboard + bayi/ürün/fiyat/kampanya yönetim + sipariş onay.

- [ ] Dashboard: canlı KPI'lar (bugün/dün sipariş + ciro + AOV + alarm sayısı)
- [ ] Bayi yönetimi: liste + detay + segment (A/B/C) + bölge atama + master CRUD
- [ ] Ürün katalog yönetimi: liste + CRUD + Excel import + kategori + barkod
- [ ] Fiyat liste hiyerarşisi: kademe iskonto + müşteri-özel + segment-bazlı
- [ ] Kampanya tanım: tarihli, hedefli (bayi/segment/bölge), kod/kupon, otomatik uygulama
- [ ] Sipariş onay akışı: kuyruğu + filtreleme + toplu onay/red + sebep notu

### Faz 2 — Bayi (alıcı) tarafı (3-4 gün)

**Hedef:** Ayşe Hanım end state'i: kayıt + katalog + sipariş + checkout + bildirim.

- [ ] WA OTP signup polish (mevcudu B2B portal akışına entegre)
- [ ] Bayi-özel ana sayfa: kampanya banner, sık siparişler, son siparişler, favoriler
- [ ] Katalog: arama + filtreleme (kategori/marka/fiyat/stok) + kart/liste görünüm + sıralama + favori
- [ ] Ürün detay sayfası: fotoğraf, açıklama, stok, tahmini teslim, kademe fiyat tablosu, "Sepete ekle"
- [ ] "Tekrar sipariş" tek-tık (önceki sipariş kartından)
- [ ] Excel toplu sipariş yükleme (ürün kodu + miktar)
- [ ] Sepet + tek-sayfa checkout + ödeme seçimi (kart / havale / açık hesap)
- [ ] Sipariş geçmişi + detay + fatura indirme
- [ ] Bildirim merkezi (in-app + WA mirror)
- [ ] Profil → Google hesap bağla sekmesi

### Faz 3 — Entegrasyonlar (1-2 hafta)

**Hedef:** "Dışarıdan API" stratejisi — ürün/stok/fiyat/bayi otomatik senkron + e-fatura çıkış.

- [ ] **Logo Tiger** entegrasyonu (öncelik 1)
  - LogoConnect / Tiger Sync API
  - Ürün master senkron (cron + webhook)
  - Stok senkron
  - Fiyat liste senkron
  - Bayi (carihesap) master senkron
- [ ] **Foriba veya Mikrohizmet** entegrasyonu (öncelik 2)
  - Sipariş onaylanınca e-Fatura kes
  - Fatura PDF bayiye WA'dan gönder
  - İade durumunda iade faturası
- [ ] **iyzico / Mollie polish** — kart + havale + açık hesap akışı son halini al
- [ ] **Aras / Yurtiçi / MNG** kargo entegrasyonu (kısmen var → tamamla)
- [ ] **Paraşüt** entegrasyonu (alternatif, Logo'su olmayan KOBİ için)

### Faz 4 — UPU farkı: WA + AI Eleman (1 hafta)

**Hedef:** NextTrack'in olmayanları aktif — gerçek farklılaşma.

- [ ] WA bildirim şablonları (14 tip, Faz'da 4. bölüm listesi)
  - Meta WA Business onaylı template'ler
  - Olay motoru wiring (sipariş onayında trigger, vade cron'unda trigger vb.)
- [ ] AI Eleman roster'ı bu milestone'a hizalı
  - **Sipariş Asistanı** — bayiye "bunu da alır mısın" cross-sell (gerçek LLM, rule-based değil)
  - **Tahsilat Asistanı** — dağıtıcıya "şu bayi gecikmeye girdi, mesaj at" önerisi
  - **Kampanya Tasarımcısı** — dağıtıcıya kampanya öner ("A-segment 2 hafta sipariş vermedi, %10 indirim atılır mı?")
- [ ] Dağıtıcı için AI Eleman chat: doğal dil sorgu ("bu hafta hangi bayi geciken")

---

## 6. Başarı Kriterleri

Milestone tamamlandığında **kanıt**:

1. **Demo bir gün senaryosu canlı:** Bir test dağıtıcısı + 3 test bayisi ile end state senaryosunun her adımı browser'da çalışıyor (kayıt + katalog + sipariş + WA bildirim + ödeme + fatura).
2. **Logo entegrasyonu en az 1 müşteri ortamında çalışıyor** (Logo Tiger demo lisansı veya bir gerçek müşteri test ortamı).
3. **Foriba e-Fatura test ortamında geçerli fatura kesiyor** (sipariş tetiği ile).
4. **14 WA bildirim tipi Meta'da onaylı + canlıda tetiklenip mesaj geliyor** (en az 10/14).
5. **AI Eleman 3 rolü canlıda** (Sipariş Asistanı, Tahsilat Asistanı, Kampanya Tasarımcısı).
6. **5 yıldızlı UX kontrolü:** sayfa açılma <2s, mobile responsive, WA OTP altı 5sn, sepet → ödeme <30sn, görsel polish (NextTrack ile yan yana koyulduğunda utanmıyor).
7. **Satılabilir paketleme:** demo video + fiyatlama + onboarding rehberi + satış sayfası (upu-web).

---

## 7. Risk + Premortem

**En büyük 3 risk:**

1. **Logo entegrasyonu beklenenden uzun** — LogoConnect API dokümanı sınırlı, gerçek müşteri ortamı olmadan tam test yapılamıyor. **Mitigasyon:** Faz 3'ün başında küçük POC, takılırsa Paraşüt'e öncelik ver.
2. **Foriba/Mikrohizmet entegrator kontratı maliyetli** — küçük dağıtıcıya satarken e-fatura entegratör masrafı çıkar. **Mitigasyon:** Faz 3 başında ticari görüşme + alternatif sağlayıcı (Edm, Veriban) karşılaştır.
3. **AI Eleman'ın "gerçek otomasyon" iddiası yine yüzeysel kalır** — sadece chat değil, **gerçek aksiyon alabilen** asistan olmalı (kampanya yaratabilir, mesaj gönderebilir, sipariş onaylayabilir). **Mitigasyon:** Faz 4'te tool-calling architecture, sandbox + onay akışı.

---

## 8. Kaynaklar

- [Modül haritası referansı](.planning/BAYI-MODUL-HARITASI-2026-06-08.md)
- [Eski plan (arşiv)](.planning/saas-roadmap/bayi-master-plan-2026-04-DEPRECATED.md)
- NextTrack B2B E-commerce — https://www.nexttrack.com.tr/solutions/b2b-ecommerce/
- NextTrack Distributor Management — https://www.nexttrack.com.tr/solutions/distributor-management/
- Logo Tiger Mobil Saha — https://www.logo.com.tr/en/logo-ecosystem-solutions/tiger-mobile-field-order

---

## 9. Sıradaki Adım

Çağrı onayı sonrası: **Faz 0 (Temizlik) brief'i yazılır** → upu-genel'e gönderilir → 1 gün içinde temizlik canlıya çıkar → Çağrı browser test → ✅ olursa Faz 1.
