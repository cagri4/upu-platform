# Sahibinden Bridge — Local Server

Express + WebSocket köprü: Telegram / cron / popup tetiklemelerini Chrome
extension'a iletir; extension'dan gelen listing payload'larını sahibi + Bodrum
filter'dan geçirip Supabase `emlak_daily_leads` tablosuna upsert eder.

Anti-bot bypass: server doğrudan sahibinden'e hiç request atmaz. Tüm DOM
parse kullanıcının gerçek Chrome'unda (debug port yok, gerçek profil) çalışır.

## Bileşenler

```
tools/sahibinden-bridge/
├── server.mjs                 — Express + WS, port 3001 (127.0.0.1)
├── package.json               — express, ws
├── .env.example               — Supabase + Telegram env şablonu
├── systemd-server.service     — user service unit
└── README.md                  — bu dosya
```

## Kurulum (~5 dk)

### 1) Server bağımlılıkları

```bash
cd tools/sahibinden-bridge
npm install
```

### 2) .env

```bash
cp .env.example .env
# .env'i düzenle: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY zorunlu.
# Telegram opsiyonel — yoksa notification skip edilir, /status polling ile öğrenilir.
```

Supabase değerleri için `.env.local`'a bak:

```bash
grep -E "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" ../../.env.local
```

### 3) systemd user service

```bash
cp systemd-server.service ~/.config/systemd/user/sahibinden-bridge.service
systemctl --user daemon-reload
systemctl --user enable sahibinden-bridge.service
systemctl --user start sahibinden-bridge.service

# Boot'ta auto-start (opsiyonel, login linger):
loginctl enable-linger $USER

# Test
curl -s http://127.0.0.1:3001/status | head
# → {"queue":[],"connected":false,"extensionCount":0,"lastScrape":null}
```

### 4) Chrome extension

`tools/sahibinden-extension/README.md` — yükleme adımları.

### 5) Cron (opsiyonel — günde 2 tetik)

```bash
crontab -e
```

```cron
0 8  * * * curl -s -X POST http://127.0.0.1:3001/trigger -H 'Content-Type: application/json' -d '{"source":"cron"}'
0 18 * * * curl -s -X POST http://127.0.0.1:3001/trigger -H 'Content-Type: application/json' -d '{"source":"cron"}'
```

## Endpoint'ler

| Method | Path | Body | Yanıt |
|---|---|---|---|
| POST | `/trigger` | `{source}` | `{queued, immediate, queueId}` |
| POST | `/listings` | `{sessionId, category, listings[]}` | `{saved, skipped, errors}` |
| POST | `/scrape-done` | `{sessionId, totalListings, totalSaved, totalSkipped, duration, errors[]}` | `{ok}` |
| POST | `/captcha-detected` | `{sessionId, url, category}` | `{ok, status:"paused"}` |
| POST | `/resume` | `{sessionId}` | `{ok, resumed}` |
| POST | `/stop` | `{}` | `{ok, stopped}` |
| GET  | `/status` | — | `{queue, connected, lastScrape}` |
| WS   | `/ws` | — | `{type:"start-scrape"|"resume"|"stop", sessionId}` |

## Filter Logic (import-v3.mjs reuse)

`/listings` endpoint payload'i 2 aşamadan geçer:

1. **Sahibi only:** `listed_by === "sahibi"` (emlakçı atlanır)
2. **Bodrum keywords:** `neighborhood` string'i `BODRUM_KEYWORDS` listesinden bir kelime içermeli

Sahibinden bazı kategorilerde "Benzer ilanlar" başlığıyla Türkiye geneli
sızıntı yapar — bu filter onları engeller.

## Telegram Notification

`scrape-done` ve `captcha-detected` event'lerinde Telegram bot mesaj atar:

```
✅ Sahibinden tarama bitti
• Toplam: 47 ilan
• Kaydedilen: 32
• Atlanan: 15
• Süre: 23.5 dk
```

```
⚠️ Captcha geldi: satilik/villa
URL: https://...
Chrome'da çöz, 'devam' yaz (POST /resume).
```

`TELEGRAM_BOT_TOKEN` env yoksa skip edilir; bot polling ile `/status`'tan öğrenir.

## Logging

Structured JSON, stdout → journal:

```bash
journalctl --user -u sahibinden-bridge -f
```

## Troubleshooting

**Server başlamıyor?**
```bash
systemctl --user status sahibinden-bridge.service
journalctl --user -u sahibinden-bridge -n 50
```

**Extension bağlanmıyor?**
- `curl http://127.0.0.1:3001/status` → `connected: false` ise extension WS bağlanamamış
- Chrome'da `chrome://extensions` → Sahibinden Bridge → "service worker" tıkla → console'da `[bg] WS connected` görmeli
- Server CORS/port engeli yok (sadece localhost dinler)

**Trigger sonrası hiçbir şey olmuyor?**
- `/status` → `connected: true` mu? Değilse Chrome açık değil veya extension yüklü değil
- Extension service worker uyumuş olabilir (popup açıp tekrar dene — service worker uyandırılır)

**Listings DB'ye yazılmıyor?**
- `.env` Supabase key doğru mu?
- journal'da `supabase upsert fail` log'u var mı?
- `emlak_daily_leads` tablosu mevcut mu? Schema scripts/import-v3.mjs ile uyumlu olmalı.

**Captcha geldi, çözdüm — devam etmiyor?**
```bash
curl -X POST http://127.0.0.1:3001/resume -H 'Content-Type: application/json' -d '{}'
```

## Eski yöntemden geçiş

Bu sistem aşağıdakileri DEVRE DIŞI bırakır:
- `scripts/scrape-v3.mjs` (yedek olarak kalır, çağrılmaz)
- `scripts/daily-scrape.sh` cron (eski 3 partili cron'u sil)

Korunur (extension yöntemi için bağımsız):
- `scripts/import-v3.mjs` (filter logic'i buraya kopyalandı — orijinali dokunulmadı)
- `scripts/export-cookies.mjs` + cookie-export systemd timer (artık scrape için gereksiz ama yedek)
- `~/.config/systemd/user/chrome-debug.service` (debug port artık kullanılmıyor; disable edilebilir)
