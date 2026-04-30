# Bayi Reklam Metni — Revize (2026-05-01)

**Aşama 7 sonu durumu.** Kod tarafıyla doğrulanmış, vaatler dürüst.

## Tek post versiyonu (LinkedIn / Facebook ana metin)

```
Hollanda'da Türk dağıtıcılar dikkat 👇

Bayilerinizden gelen siparişten tahsilata kadar — hepsi WhatsApp'tan,
AI desteğiyle tek yerden.

upu size ne sağlar?
✅ Bayi WhatsApp mesajları AI ile algılanır, onayınızla siparişe dönüşür
✅ Vade hatırlatma metnini AI yazar, onayınızla bayiye gider
✅ Saha ekibiniz WhatsApp'tan rota + ziyaret notu girebilir
✅ Yuki, Exact, SnelStart muhasebenizle senkron — ekstra iş yok

🇳🇱 KvK + BTW + Peppol uyumlu
🇹🇷 Türkçe arayüz + Hollandaca bayi mesajları
⚡ İlk müşteri: 5 gün canlı veri kurulumu (concierge dahil)
🔒 30 gün içinde memnun kalmazsanız tam iade — soru sormadan
🎁 İlk 10 müşteri: kurulum ücretsiz + 3 ay yarı abonelik

3 paket — ihtiyacınıza göre:
• Starter €99/ay (3 çalışan, 50 bayi)
• Growth €249/ay (10 çalışan, 200 bayi, SEPA dahil) ⭐
• Pro €599/ay (sınırsız + Peppol + dedicated AM)

📩 DM ile 30 dakikalık demo isteyin
```

## Vaatlerin koda denk gelmesi (doğrulama tablosu)

| Vaat | Önceki durum | Şu an (2026-05-01) |
|---|---|---|
| WA→sipariş AI ile algılanır | Yarı vaat (form'a düşüyordu) | ✅ Aşama 3 — direkt insert (conversational.ts) |
| AI tahsilat metni | Yarı vaat (autonomous tool stub) | ✅ Faz 4 + Aşama 6 — ai_dunning_text Growth+ feature |
| Saha rep WA tabanlı | Yarı vaat (jenerik) | 🟡 Sınırlı — "rotam" özel logic v2'ye, basic WA OK |
| Yuki/Exact/SnelStart entegre | Yarı vaat (env-var bekliyor) | 🟡 Faz 5 — Chift adapter, prod env-var şart |
| KvK + BTW uyumlu | Doğru | ✅ Faz 1 + 4 — form alanları, validasyon |
| Peppol uyumlu | YANLIŞ vaat | ✅ Aşama 4 — Storecove gerçek implementation |
| Türkçe + Hollandaca | Doğru sınırlı | ✅ Faz 1 — multi-locale framework |
| 5 gün kullanıma hazır | Yarı (env şart) | 🟡 Concierge + demo data + env'ler set edilince doğru |
| 30 gün iade | YANLIŞ (config yoktu) | ✅ Aşama 5 — config + endpoint + landing banner |
| 3 tier farkı | Yarı (sadece fiyat) | ✅ Aşama 6 — gerçek tier-features.ts + enforcement |

## Kalan production şartları (reklam yayınlamadan önce)

Vercel env-var'ları set edilmeden bazı vaatler boş laf:
- `CHIFT_API_KEY` + `CHIFT_ACCOUNT_ID` (Yuki/Exact/SnelStart)
- `MOLLIE_API_KEY` (iDEAL + SEPA)
- `POSTNL_API_KEY` + `POSTNL_CUSTOMER_CODE` + `POSTNL_CUSTOMER_NUMBER` (kargo)
- `STORECOVE_API_KEY` + `STORECOVE_LEGAL_ENTITY_ID` (Peppol)
- `STRIPE_API_KEY` (iade akışı; manuel fallback yedek var)
- `CRON_SECRET` (fair-use cron auth)

**Reklam yayınlandığında müşteri "ekstrasını test edeyim" derse env-var
yoksa "Henüz hazır değil" mesajıyla karşılaşır → güven sıfırlanır.**
Bu yüzden **env-var'ları set + sandbox testi** yapmadan reklam çıkmasın.

## Pricing alt açıklama (reklam altında veya landing'de)

```
Starter (€99): Tek başınıza başlıyorsanız.
Growth (€249) ⭐: Ekiple büyüyen + vade gecikmesi var → SEPA Direct Debit
otomatik vade çekiyor. Setup ücretsiz dahil.
Pro (€599): 100+ bayi, çoklu marka, denetim hazırlığı → Peppol e-fatura
+ multi-territory + dedicated account manager.

Setup: €749 tek seferlik (Growth ve Pro'da dahil, Starter'da opsiyonel,
3 taksit imkanı).

İlk 10 müşteri promo: setup ücretsiz + 3 ay yarı abonelik. Şu an
n_müşteri/10 değeri açık değilse kontrol edin.
```

## Sosyal medya story versiyonu (kısa, mobil)

```
🇳🇱 Türk dağıtıcı mısın?

Bayilerinden WhatsApp'a "abi 5 koli" yazılıyor.
upu otomatik:
• Sipariş çıkarır
• Vade hatırlatır
• Yuki/Exact'e yazar
• PostNL etiketini basar

€99/ay'dan başlıyor.
30 gün iade garantisi.

DM at, 30 dk demo.
```

## E-mail outreach versiyonu (B2B doğrudan)

```
Konu: Hollanda Türk Dağıtıcılarına Özel — WhatsApp + AI ile Bayi
Yönetimi (30 gün iade garantili)

Sayın [İsim],

Hollanda'da [Firma Adı] olarak gıda toptan / horeca / kuruyemiş /
hırdavat dağıtımı yapıyorsunuz. Bayilerinizle iletişiminizin %80+'ı
WhatsApp'ta — ama sipariş kaydı, vade takibi, fatura kesme hala
ayrı sistemlerde duruyor olabilir.

upu — WhatsApp + AI destekli bayi yönetim platformu.

3 somut değer:
1. Bayi "abi 5 koli" yazıyor → AI ürün eşleştiriyor → onayınızla
   bayi_orders'a kaydediliyor. Form yok, sipariş 30 saniyede.
2. Vade gelmiş 8 fatura için tek tıkla AI metin draft → onaylıyorsunuz
   → bayilere gidiyor. Mollie iDEAL + SEPA Direct Debit ile bayi
   tıklayıp anında ödüyor.
3. Yuki / Exact / SnelStart ile senkron — siz fatura kesiyorsunuz,
   biz Peppol UBL'e dönüştürüp bayinin muhasebesine iletiyoruz.

Paketler: €99/€249/€599 (Starter / Growth / Pro). Setup €749 tek
seferlik (Growth+ paketlerinde dahil). İlk 10 müşteri promo: setup
ücretsiz + 3 ay yarı abonelik.

30 gün iade garantisi — soru sormadan, abonelik + setup tamamen geri.

30 dakikalık demo'da kendi WhatsApp mesajlarınızdan canlı sipariş
çıkarabiliriz. Müsait olduğunuz bir zaman bildirin.

Saygılarımla,
[İsim]
upu — upudev.nl
info@upudev.nl
```

## Pazarlama notu

- **"AI Tahsilat metni"** ifadesi reklamdan çıktı — yarı doğru, müşteri
  WA'da somut göremezse şüphe doğurur. Yerine "Vade hatırlatma metnini
  AI yazar, onayınızla bayiye gider" — somut + dürüst.
- **"Saha rep verimli"** somutlaştırıldı: "WhatsApp'tan rota + ziyaret
  notu girebilir" — abartı yok, gerçek capability.
- **"Peppol uyumlu"** artık dürüst (Aşama 4 implement). KvK + BTW
  öncesinde, üçü birlikte yazıldı (Hollanda B2B uyum üçlüsü).
- **Pricing 3 paket** yansıdı (önceki reklam tek fiyat sundu, müşteri
  "ya yetmezse" sorusu aldı).
- **30 gün iade vurgusu** kalın — Türk B2B'de "ilk ay garantisi" sıcak
  algılanır, satın alma engelini siler.
