# Sahibinden Cookie Bridge

Chrome extension + local Node receiver: kullanıcı Chrome'da sahibinden'e giriş
yapar, extension arka planda her 5 dakikada bir cookie'leri local endpoint'e
gönderir, receiver bunları `scripts/cookies.json`'a yazar. Cron scrape
(`daily-scrape.sh`) her zaman taze cookie ile çalışır.

## Bileşenler

```
tools/
├── sahibinden-cookie-bridge/
│   ├── manifest.json       — MV3 extension manifest
│   ├── background.js       — Service worker (cookies API + 5dk alarm + fetch)
│   ├── icon.png            — 128x128 toolbar icon
│   └── README.md           — bu dosya
├── cookie-receiver.mjs     — Node HTTP server (port 3001, POST /cookies)
└── cookie-receiver.service — systemd user service unit
```

## Kurulum (tek sefer, ~2 dk)

### 1) Chrome extension yükle

```
chrome://extensions  →  "Developer mode" ON (sağ üst)
                    →  "Load unpacked"
                    →  tools/sahibinden-cookie-bridge/  klasörünü seç
```

Extension toolbar'da görünür. Bir kez `sahibinden.com` aç → cookie'ler set
olur → sonraki alarm tetiklenmesinde receiver'a gönderilir.

### 2) Receiver servisi kur

```bash
# systemd unit'i user dizinine kopyala
mkdir -p ~/.config/systemd/user
cp tools/cookie-receiver.service ~/.config/systemd/user/

# Enable + start
systemctl --user enable cookie-receiver.service
systemctl --user start cookie-receiver.service

# Boot'ta otomatik başlasın (login linger gerekli, opsiyonel):
loginctl enable-linger $USER
```

Manuel çalıştırma (systemd kullanmak istemiyorsan):

```bash
node tools/cookie-receiver.mjs
# Output: [Receiver] Listening on http://127.0.0.1:3001/cookies
```

### 3) Doğrulama

Receiver çalışıyor mu?

```bash
systemctl --user status cookie-receiver.service
# Active: active (running)

# Veya direkt test:
curl -X POST http://127.0.0.1:3001/cookies \
  -H "Content-Type: application/json" \
  -d '{"cookies":[{"name":"test","value":"1"}]}'
# → "ok"
```

Extension çalışıyor mu?

```
chrome://extensions  →  Sahibinden Cookie Bridge  →  "service worker" tıkla
DevTools console'da: [Bridge] N cookies exported at HH:MM:SS
```

`scripts/cookies.json` güncel mi?

```bash
stat -c %y scripts/cookies.json
# Son 5 dakika içinde olmalı
```

## Sıklık + Davranış

- **5 dakikada bir** alarm çalar → cookie export → POST
- Browser startup'ta ek bir kez tetiklenir
- Receiver kapalıysa fetch sessiz fail eder, bir sonraki alarm'da tekrar denenir
- `scripts/cookies.json` yazılmadan önce mevcut dosya `scripts/cookies.json.backup`'a kopyalanır (1 versiyon rolling backup)
- Receiver sadece `127.0.0.1:3001` dinler (dış erişim yok)

## Troubleshooting

**`scripts/cookies.json` güncellenmiyor?**

1. Receiver çalışıyor mu? `systemctl --user status cookie-receiver.service`
2. Extension yüklü ve sahibinden cookie var mı? Chrome'da `sahibinden.com` aç, giriş yap
3. Extension service worker console'da hata var mı? `chrome://extensions` → Service worker
4. Manuel test: `chrome://extensions` → Bridge → Background page → console:
   ```js
   chrome.runtime.sendMessage({ debug: true });
   ```
   (veya browser'ı kapat/aç, startup hook bir kez tetikler)

**Port 3001 çakışıyor?**

`tools/cookie-receiver.mjs` içinde `PORT` ve
`tools/sahibinden-cookie-bridge/background.js` içinde `LOCAL_ENDPOINT`
ikisini birlikte değiştir.

**"No sahibinden cookies found" warning?**

Chrome'da hiç sahibinden.com'a girilmemiş. `https://www.sahibinden.com` aç,
giriş yap, ~5 dk bekle.

## Manuel fallback

Extension/receiver bozulursa eski yöntem hâlâ çalışır:

```bash
node scripts/export-cookies.mjs
# Chrome cookie DB'sinden direkt decrypt + yaz
```
