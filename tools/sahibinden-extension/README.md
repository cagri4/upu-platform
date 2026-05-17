# Sahibinden Browser Bridge — Chrome Extension (MV3)

`tools/sahibinden-bridge/` server'ı ile WebSocket üzerinden konuşur. Server
"start-scrape" mesajı atınca extension 23 Bodrum kategorisini sırayla yeni
tab'larda açar, DOM parse eder, sonuçları server'a POST'lar, tab'ı kapatır.

Anti-bot bypass: Chrome `--remote-debugging-port` flag'i YOK, gerçek
kullanıcı profili, normal browse trafiği. Sahibinden açısından insan.

## Dosyalar

```
tools/sahibinden-extension/
├── manifest.json    — MV3 manifest (tabs, scripting, host permissions)
├── config.js        — 23 URL + bridge endpoint config (ESM)
├── background.js    — service worker: WS client + tab orchestrator
├── content.js       — DOM scraper (sahibinden.com matches, message-driven)
├── popup.html       — popup UI
├── popup.js         — popup logic (trigger, stop, status badge)
├── icon.png         — 128×128 toolbar icon
└── README.md        — bu dosya
```

## Kurulum (1 dk)

1. `tools/sahibinden-bridge/` server'ı çalışıyor olmalı (`curl 127.0.0.1:3001/status`)
2. Chrome'da `chrome://extensions/` aç
3. Sağ üst **Developer mode** ON
4. **Load unpacked** → `tools/sahibinden-extension/` klasörünü seç
5. Toolbar'da sarı **SB** ikonu görünür

## Doğrulama

- `chrome://extensions` → Sahibinden Bridge → **service worker** linki → DevTools
  console'da `[bg] WS connected: ws://127.0.0.1:3001/ws` görmeli
- Popup aç → "Bağlantı: ✅ 1" yazıyor olmalı

## Kullanım

**Manuel:**
- Popup → "🟡 Bodrum'u Tara" → server `/trigger` POST → extension 23 tab açar (60sn aralık)

**Telegram:**
- Bot "tara" yazınca claude-telegram `/trigger` POST eder → extension çalışır

**Cron:**
- 08:00 + 18:00 otomatik tetik (server README'sine bak)

## Akış

1. Tab açılır (background, kullanıcı aktif tab'ını bozmaz)
2. `document_idle` → content script mount + 3 sn ek bekleme (JS render için)
3. background → content message: `{type:"parse", category, ...}`
4. content captcha kontrol → varsa `{captcha:true}` döner
5. content DOM parse (`.searchResultsItem` selector) → `{listings:[...]}`
6. background → server `POST /listings`
7. Tab kapatılır
8. 60 sn bekle, sıradaki kategoriye geç
9. 23 URL bitince `POST /scrape-done`

## Captcha Davranışı

Content script "Olağan dışı erişim", "Basılı Tut", `.error-page-container`,
`/giris` redirect, captcha iframe tespit ederse:

1. background → server `POST /captcha-detected` (sessionId, url, category)
2. Server Telegram'a notify: "⚠️ Captcha geldi: {category}"
3. background WS `resume` mesajı bekler (server'dan)
4. Kullanıcı manuel olarak Chrome'da captcha'yı çözer
5. Telegram bot'a "devam" yazar → server `POST /resume` → broadcast
6. Extension mevcut URL'yi atlayıp sıradaki kategoriye geçer

## Selector Güncellemesi

`content.js` içindeki `extractListings()` ve `parseRow()` fonksiyonları
`scripts/scrape-v3.mjs`'den birebir kopya. Sahibinden HTML değişirse:

1. `scripts/scrape-v3.mjs` selector'larını güncelle
2. `content.js`'i de aynı şekilde güncelle
3. Extension reload (`chrome://extensions` → Sahibinden Bridge → ↻)

## Limitasyonlar

- Chrome açık olmalı (extension service worker uyuyabilir → popup açınca uyanır)
- Çoklu Chrome profile'da hangi profile aktifse o trigger alır
- 23 URL × 60 sn = ~23 dakika minimum (captcha yoksa)
- Tek extension instance — birden fazla Chrome açıksa WS broadcast hepsine gider
  (her birinin tab orchestrator'ı paralel çalışır — duplicate işlem riski)
- Session ID server'da tutulur; extension restart'ı session'ı bilmez (yeniden tetik gerekir)
