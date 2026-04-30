# Bayi Tenant — 30 Gün İade Politikası

**Aşama 5 sonu durumu (2026-05-01)**

## Özet

upu Bayi Yönetim Sistemi müşterilerine **30 gün içinde tam iade** garantisi.
Stripe entegrasyonuyla otomatik, manuel destek yedekli.

## Politika kuralları

- **Süre:** Hesap açılışından (profile.created_at) itibaren **30 takvim günü**.
- **Kapsam:** Aylık abonelik + opsiyonel kurulum ücreti — **ikisi de tam iade**.
- **Şart:** "Memnun kalmamak" — başka kanıt aranmaz, soru sormadan iade.
- **Süreç:** Müşteri "iade istiyorum" → /api/bayi-billing/refund POST → Stripe API üzerinden iade + abonelik iptal.
- **Manuel fallback:** Stripe entegre değilse iade talebi profile.metadata.refund_requests'e kayıt, info@upudev.nl üzerinden 2 iş günü içinde işlenir.

## Konfigürasyon

`src/tenants/config.ts:bayi.pricing.refund`:
```ts
refund: { firstNDays: 30, fullRefund: true }
```

## API endpoint

`POST /api/bayi-billing/refund`

**Request:**
```json
{ "token": "magic_link_token", "reason": "..." }
```

**Response (Stripe entegre, akış başarılı):**
```json
{ "success": true, "manual": false, "refund_amount_cents": 17400 }
```

**Response (Stripe yok, manuel fallback):**
```json
{ "success": true, "manual": true, "message": "..." }
```

**Response (süre dolmuş, 410):**
```json
{ "error": "İade süresi dolmuş (30 gün limit). Hesabınız 2026-04-01 tarihinde açıldı." }
```

## Privacy/Terms metnine eklenmesi gereken

`/[locale]/terms` sayfasına aşağıdaki metni ekleyin:

### TR
> **30 Gün İade Garantisi.** İlk 30 gün içinde memnun kalmazsanız ödediğiniz tüm tutarı (aylık abonelik + kurulum ücreti) tam olarak iade ederiz. İade için info@upudev.nl adresine yazmanız veya panelinizdeki "İade İste" linkine tıklamanız yeterli — soru sormadan, gerekçe istemeden 2 iş günü içinde Stripe üzerinden geri ödenir. 30 günden sonra iade talepleri özel durumlar için manuel değerlendirilir.

### NL
> **30 Dagen Geld-Terug-Garantie.** Niet tevreden binnen de eerste 30 dagen? Volledige terugbetaling van uw abonnement én setup-kosten. Stuur een mail naar info@upudev.nl of klik op "Terugbetaling Aanvragen" in uw paneel — geen vragen gesteld, binnen 2 werkdagen via Stripe terugbetaald. Na 30 dagen worden terugbetalingsverzoeken individueel beoordeeld.

### EN
> **30-Day Money-Back Guarantee.** Not satisfied within the first 30 days? Full refund of subscription + setup fee. Email info@upudev.nl or click "Request Refund" in your panel — no questions asked, refunded via Stripe within 2 business days. After 30 days, refund requests are evaluated case by case.

## Stripe entegrasyonu (gelecek)

`STRIPE_API_KEY` env-var'ı set edildiğinde refund endpoint otomatik aktif olur. Akış:

1. Customer'ın son ödemelerini Stripe'tan çek (charges API)
2. Henüz iade edilmemiş charge'lar için POST /v1/refunds
3. Aktif subscription varsa DELETE /v1/subscriptions/{id}
4. profile.metadata.refunded_at + status: refunded güncellemesi

Henüz Stripe entegre değilse:
- Talepler profile.metadata.refund_requests array'ine yazılır
- info@upudev.nl üzerinden manuel handle
- Müşteri "talep alındı, 2 iş günü" cevabı alır

## Reklam yansıması

`messages/{tr,nl,en}.json` → `tenants.bayi.refund_banner` key seti.
Pricing section'da **emerald-50 banner** ile gösteriliyor:

> 🔒 30 gün içinde memnun kalmazsanız tam iade — soru sormadan, abonelik + kurulum tamamen geri

Reklamda Vaat 8 ("İlk ay memnun kalmazsanız iade") artık config'e bağlı, dürüst.
