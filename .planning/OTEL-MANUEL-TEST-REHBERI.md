# Otel SaaS — Manuel Test Rehberi (Çağrı)

> Uçtan uca 6 modülü canlıda test et. Her adımda **beklenen sonuç** verildi.
> Sırayla yap, her adım bir önceki adımı kontrol eder.

**Canlı URL**: `https://hotelai.upudev.nl`

**Önce**: Otel'e giriş yap (WA üzerinden gelen sihirli linkle veya cookie session). Dashboard açılmalı.

---

## 0. Hazırlık (1 dk)
1. `/tr/otel-panel` aç → 6 KPI ve hızlı aksiyon butonları görmeli.
2. **Sidebar**'da en az bu linkler olmalı:
   - Dashboard, AI Asistan, Rezervasyonlar, Müşteriler, Müsaitlik Takvimi, Odalar, Kat Hizmetleri, Fiyat Takvimi, Gelir Raporu, Web Sitesi, KBS Bildirim, Ödemeler, Mesaj Taslakları, Profilim.

✅ **Beklenen**: 14 sidebar linki, sayfalar 200 dönüyor.

---

## 1. PMS — Oda + Rezervasyon (3 dk)

### 1a. Yeni Oda
1. **Odalar** → sağ üstte **Yeni Oda** butonuna bas.
2. Modal: ad `Test-101`, tip `standart`, yatak `çift`, maks 2 kişi, gecelik `2000`, durum `Temiz`.
3. **Oluştur** → kart listede görünmeli.

### 1b. Yeni Rezervasyon
1. **Rezervasyonlar** → **Yeni Rezervasyon** butonuna bas.
2. Modal: misafir `Çağrı Test`, telefon `+90 555 111 2233`, oda `Test-101`, giriş bugünden 7 gün sonra, çıkış 10 gün sonra (3 gece).
3. **Oluştur** → Liste'de görmeli. ✅ Beklenen: ekleme başarılı, toplam fiyat otomatik **6.000 ₺** (3 × 2000).

### 1c. Müsaitlik Takvimi
1. **Müsaitlik Takvimi** → 30 günlük grid görmeli. Test-101 satırında giriş tarihinden başlayan 3 gün renkli (mavi/yeşil) bant.
2. Banta tıkla → modal: misafir adı + tarih + tutar.

### 1d. Çift Rez Engeli
1. Yine **Yeni Rezervasyon** dene — aynı oda + aynı tarih.
2. ✅ Beklenen: **"Seçilen tarihlerde oda zaten dolu"** hata mesajı.

### 1e. Check-in / Check-out
1. **Rezervasyonlar** listesinde Çağrı Test kaydı → tarih bugüne çekersen yeniden ekle, ya da bekle.
2. **Çek-in** butonuna bas → status `Konaklamada` olmalı.
3. **Çek-out** butonuna bas → status `Çıktı`. Odanın durumu otomatik `dirty` olur, **Kat Hizmetleri**'nde otomatik bir görev belirir.

---

## 2. Fiyat Takvimi + Housekeeping (2 dk)

### 2a. Sezon Fiyatı
1. **Fiyat Takvimi** → **Sezon Ekle** butonu.
2. Oda tipi `standart`, başlangıç bugünden 14 gün, bitiş 20 gün, fiyat `3500`, etiket `Yüksek Sezon`.
3. **Uygula** → grid'de o aralıkta turuncu hücreler.

### 2b. Sezon doğrulama
1. **Rezervasyonlar** → **Yeni Rezervasyon** → tarih: sezon aralığı içi, oda Test-101.
2. ✅ Beklenen: toplam fiyat otomatik **3500 × gece** hesaplanır (override aktif).

### 2c. Housekeeping
1. **Kat Hizmetleri** → otomatik oluşan `check_out_clean` görevi olmalı (1c'den).
2. **Başla** → status `Devam ediyor`.
3. **Tamamla** → status `Tamamlandı` + odanın durumu otomatik **Temiz** olmalı.

---

## 3. Web Sitesi + Booking Engine (3 dk)

### 3a. Web Sitesi Aç
1. **Web Sitesi** → slug `caretta-test` (veya `marina-resort`).
2. Hero başlık: `Test Otel`, alt başlık: `Konfor için doğru adres`.
3. Galeri'ye 1-2 görsel URL ekle (örn. `https://picsum.photos/800/600`).
4. Olanaklar: `WiFi`, `Kahvaltı`, `Otopark`.
5. **Yayına al** kutusunu işaretle → **Kaydet**.

### 3b. Public Landing
1. Açılan **Public URL**'i kopyala (üstteki `Aç` butonu).
2. Yeni sekmede aç (gizli pencere veya farklı tarayıcı önerilir — login'siz).
3. ✅ Beklenen: hero + oda tipleri + galeri + olanaklar + iletişim sayfası 200.

### 3c. Direct Booking
1. Landing'de **Rezervasyon Yap** butonu → `/o/[slug]/rezervasyon` açılır.
2. Tarih seç (10 gün sonra başlangıç, 12 gün sonra çıkış) → **Müsait Odaları Göster**.
3. Bir oda seç → ad/tel/email gir, **KVKK** onayını işaretle → **Rezervasyon Talebi Gönder**.
4. ✅ Beklenen: `/o/[slug]/onay/[id]` sayfası "Talebiniz Alındı" + rez kodu görmeli.
5. **Otel paneline dön** → **Rezervasyonlar** listesinde yeni rez `pending` status'ünde olmalı.

---

## 4. KBS — Online Check-in + Mock Submission (2 dk)

### 4a. Misafir Online Check-in (WA mekik)
1. WA mevcut bir rez için online check-in linkini misafir tıklayacakmış gibi simüle et:
   - `/tr/otel-cekin?t=<token>` (otomatik: cron T-24h)
   - veya **Rezervasyonlar** detayda link var.
2. Form: TC `12345678901`, doğum `1990-01-01`, uyruk `TR`, anne/baba adı, cinsiyet.
3. Kimlik fotoğrafı yükle (herhangi bir görsel).
4. **KVKK** onayı → **Tamamla**.

### 4b. KBS Dashboard
1. **KBS Bildirim** sayfası → MOCK MOD uyarısı görmeli.
2. ✅ Beklenen: 4a'da otomatik bir submission oluşmuş, status `Kabul edildi` / `Beklemede` (mock weighted random — %85 accept).
3. Eğer rejected çıktıysa kayıt üzerinde **Tekrar gönder** butonu olmalı.

### 4c. Manuel KBS Submit
1. "Bildirim Bekleyenler" bölümünde başka bir confirmed rez varsa **KBS'ye gönder**.
2. Mock sonuç dönmeli (200ms latency).

---

## 5. Tahsilat + Fatura (3 dk)

### 5a. Mollie Online Ödeme
1. **Ödemeler** → **Yeni ödeme**.
2. Rezervasyon seç, tip `Kapora (%30)`, yöntem `Mollie (online)`.
3. **Oluştur** → liste'de yeni payment `Ödeme aç.` status'ünde + **Mollie** butonu.
4. Mollie butonuna bas → ✅ Mollie ödeme sayfası açılmalı (test mod).
5. Test kart ile öde → `/o/[slug]/odeme/[id]` sayfasında "Ödeme tamamlandı" görmeli.
6. Panel'e dön: listede status `Ödendi` olmalı (webhook).

### 5b. IBAN/Nakit
1. **Yeni ödeme** → yöntem `IBAN/Havale` → **Oluştur**.
2. Listede `Bekliyor` + **Geldi** butonu.
3. **Geldi** → status `Ödendi`.

### 5c. KPI Doğrulama
1. **Ödemeler** sayfasının üstündeki "Toplam tahsilat" KPI'ı ödemelerin toplamı kadar artmalı.
2. **Dashboard**'da "Bu Ay Gelir" KPI'ı güncellenmiş olmalı (paid rez'leri yansıtır).

### 5d. e-Arşiv Fatura (Mock)
1. **Ödemeler** → **Faturalar** tab → **Yeni fatura**.
2. Rez seç, tip `e-Arşiv`, VKN/TCKN gir, tutar otomatik gelmeli.
3. **Kes** → liste'de `MOCK` badge + **Kabul edildi** + PDF linki.
4. PDF link aç → mock URL (`mock-efatura.upudev.nl/pdf/...`) — gerçek PDF yok, mock olduğu için.

### 5e. İade
1. Paid bir kayıt üzerinde **İade** butonu → confirm.
2. Liste'de yeni `İade` payment kaydı + orijinal kayıt `İade edildi`.
3. KPI "Toplam tahsilat" iade tutarı kadar azalmalı (paid_amount trigger çalışır).

---

## 6. AI Asistan — Onay Kuyruğu (4 dk)

### 6a. Mock Seed
1. URL bar'a sok ve POST yap (terminal):
   ```
   curl -X POST https://hotelai.upudev.nl/api/otel-panel/agent-mock-seed \
        -H "Content-Type: application/json" \
        -b "<cookie>" -d '{}'
   ```
   veya **Bilgi Bankası** sayfasında "henüz veri yok" deyince benzer bir test seed butonu (varsa).
2. ✅ Beklenen: 5 mock Google yorumu + 3 bilgi bankası kaydı eklendi.

### 6b. Bilgi Bankası
1. **AI Asistan** > **Bilgi Bankası** linki → 3 kayıt görmeli (Otelimiz / Check-in / Kahvaltı).
2. **Yeni Bilgi** → ek bir madde ekle (örn. `Evcil Hayvan Politikası`).
3. ✅ Beklenen: liste güncellendi.

### 6c. AI Asistan ile Konuşma
> Bu kısım v2 — şu an Onay Kuyruğu sayfasında chat UI'sı yok.
> AI chat doğrudan API ile test edilir (terminal):
> ```
> curl -X POST https://hotelai.upudev.nl/api/otel-panel/agent-chat \
>   -H "Content-Type: application/json" -b "<cookie>" \
>   -d '{"message":"Yarın için 2 kişilik müsait oda var mı?"}'
> ```
> AI `check_availability` tool'unu çağırıp boş odaları döner.

### 6d. Onay Kuyruğu — İtibar
1. **AI Asistan** → filter `Bekleyen` → seed'den bir mock yorum üzerinde AI taslak yanıtı bekleyebilir.
2. (Şu an UI'dan tetiklenmiyor; chat API'dan tetiklenir. Test için Bilgi Bankası "ai test yanıtı" eklemek yerine doğrudan DB'ye approval insert edilmiş olmalı.)
3. Bekleyen kayıt görünce: **Düzenle** → metni değiştir → **Düzenlenmiş Hali Onayla**.
4. ✅ Beklenen: status `Onaylandı`, yorum kaydı `published` olur (Faz 5 side-effect).
5. veya **Reddet** → red sebebi gir → status `Reddedildi`, yorum `unanswered`'a döner.

---

## 7. Otomatik E2E Test (terminal, ~5 saniye)
```
set -a; source .env.local; set +a
node scripts/otel-e2e-test.mjs
```
✅ Beklenen: `PASS: 21 / FAIL: 0`. Tüm DB işlemleri + RPC + trigger + side-effect'ler doğrulanır.
`--keep` flag ile test verileri silinmez (debug için).

---

## Bilinen Mock'lar (gerçek entegrasyon beklenenler)
| Modül | Mock | Gerçek için gereken |
|---|---|---|
| KBS | weighted random %85 accept | Polis Genel Müd. tesis kodu + güvenli kimlik |
| e-Fatura | %92 accept + mock PDF URL | Entegratör hesabı (e-Finans / Logo / Sovos / Mikro) |
| Google Reviews | DB tablosu + manuel seed | GBP API onayı (60+ gün GBP, formal access request) |
| Mollie | Test mode | MOLLIE_API_KEY (test_*** veya live_***) |
| Caretta Firestore | adapter STUB (null/log) | CARETTA_FIREBASE_PROJECT_ID + PRIVATE_KEY |
| AI Chat | Mevcut | ANTHROPIC_API_KEY (veya ANTHROPIC_API_KEY_OTEL) |

---

## Sorun olursa
- Sayfa 200 vermiyorsa: token expired olabilir, WA'dan yeni magic link al.
- Mollie sayfası açılmıyorsa: MOLLIE_API_KEY env yok ya da hatalı.
- AI Chat çalışmıyorsa: ANTHROPIC_API_KEY env eksik (API endpoint 503 döner).
