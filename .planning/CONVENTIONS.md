# upu-platform — Konvansiyon Referansı

Bu dosya kod yazarken/refactor ederken uyulması gereken kuralların kısa
referansıdır. Yeni Claude oturumu önce bunu okur, sonra ARCHITECTURE.md.

## Dil ve İsimlendirme

- **Türkçe naming.** Komutlar (`mulkekle`, `siparisolustur`), web sayfaları
  (`/tr/mulkekle-form`), API endpoint'leri (`/api/musteri/save`), DB tablo isimleri
  domain-specific prefix'le (`emlak_*`, `bayi_*`, `otel_*`, `mkt_*`, `muh_*`, `sy_*`).
- **Yorumlar Türkçe** kabul edilir, kod identifier'ları **Türkçe ASCII** (ı/ğ/ç yok,
  Latin ASCII tercih: `mulkekle` not `mülkekle`).
- **Commit mesajı formatı:** `tip(scope): kısa açıklama` Türkçe veya İngilizce
  (örn: `feat(sunum): Devam Et butonu eklendi`). Tip: feat/fix/refactor/chore/docs.
- **Atomik commit.** Her fix/feature ayrı commit. Bundle yok. Bir bug fix
  surrounding cleanup içermez.

## WhatsApp UX

- **wa.me linklerinde `?text=...` YOK.** Kullanıcı "devam" yazmak zorunda
  kalmasın. Konuşma kutusu temiz açılsın. (Ref: `e904201` commit.)
- **Magic link TTL 24h** (mulk/musteri formları). Kısa flow için 15dk-30dk de OK
  (örn: webpanel girişi).
- **Idempotent flag pattern:** Form sonrası `metadata.<step>_finished_at` yazılır,
  aynı form iki defa tetiklenmesin (örn: `metadata.mulklerim_finished_at`).
- **Form sonrası akış:** API endpoint `after()` içinde:
  1. WA'ya "✅ kaydedildi" mesajı (sendText)
  2. Sonraki adımın magic link butonu (sendUrlButton)
  3. Idempotent flag yaz
  Kullanıcı web form'da "WhatsApp'a Dön" → wa.me/{BOT_NUMBER} (text yok!).
- **Nav footer.** Kritik mesajdan sonra `sendNavFooter(phone)` ile "Ana Menü" butonu
  ekle (kullanıcı kayıp hissetmesin).
- **Async push nav kuralı:** Cron veya push sonrası bir mesajdan sonra her zaman
  nav butonu (Ana Menü). Koridor içi (multi-step session içi) skipNav: true.

## Web Form Pattern

Ağır UI işleri WA'da değil web'de:
- Foto upload, slayt edit, profil bilgileri, müşteri formu → web form
- Web form sayfası: `src/app/[locale]/{flow}-form/page.tsx`
- API kaydetme: `src/app/api/{flow}/save/route.ts`
- POST body: `{ token, ...data }` — token magic_link_tokens'tan validate edilir
- Token süresi geçmişse 400 dön ("Linkin süresi dolmuş.")
- Save sonrası `after(async () => { ... })` ile WA notify + sonraki magic link

## Auth/Session

- **`magic_link_tokens`** — { user_id, token, expires_at, used_at? }. 24h default
- **`extension_tokens`** — { user_id, code (6-hex), expires_at }. Chrome uzantısı
  eşleşmesi için
- **`command_sessions`** — { user_id, tenant_id, command, current_step, data jsonb }.
  Multi-step WA komutu için (örn: sözleşme adımları)
- **`profiles`** — { id, tenant_id, whatsapp_phone, display_name, metadata jsonb }.
  metadata içine subdomain ek bilgiler (agent_profile, onboarding flags)

## Database Pattern

- Her tenant tablo isimleri prefix'li: `emlak_properties`, `bayi_orders`, vb.
- **`tenant_id` her tabloda FK.** Cross-tenant veri sızması olmasın.
- **RLS policies** — tenant'a göre filtrelenir. Service client (server-side) RLS
  bypass eder, ama sorgu yine de tenant_id ile filtrelenmeli.
- **snapshot_date / today-only retention** — günlük leads gibi tablolarda
  `DELETE WHERE snapshot_date < CURRENT_DATE` ile temizleme (emlak_daily_leads
  pattern).

## Scrape (sahibinden, Bodrum-only)

- 23 URL, 3 parti (03:00 part1, 04:30 part2, 06:00 part3)
- ScrapingBee yok — yerel Puppeteer + cookie auto-refresh (export-cookies.mjs)
- BODRUM_KEYWORDS whitelist: import-v3.mjs içinde (Bodrum, Yalıkavak, Gümüşlük, vs.)
- Progress reset: `daily-scrape.sh part1` başında v3-progress.json silinir
- 5-imza monitoring: scripts/monitor-scrape.sh her partinin sonunda sinyalleri
  kontrol eder, tetiklenirse /api/admin/scrape-alert ile admin'e WA gönderir.

## Deploy

- **Vercel auto-deploy main branch'ten.** `git push origin main` → ~50s build →
  prod.
- **Push sonrası MUTLAKA `vercel ls`** ile Ready/Error doğrula. Hobby plan'de cron
  limit sıkı (yeni cron eklerken bana sor).
- **vercel.json** içinde sadece kritik cron'lar olmalı.
- Build hatası olursa hemen fix push'la, prod'da hatalı versiyon kalmamalı.

## Olmayacak Şeyler

- **Mock yok production-relevant testlerde.** Integration tests gerçek DB'ye hit
  etsin (kullanıcının önceki incident kuralı).
- **Backwards-compat shim'ler eklenmez.** Tek developer/operator olduğun için eski
  kod direkt silinir.
- **Yorum-paragraf yok.** Tek satır + WHY (non-obvious) sadece.
- **Comments WHAT açıklamaz.** Identifier'lar zaten anlatır.
- **Dokümantasyon dosyaları (.md) explicit istenmedikçe eklenmez** (bu kural
  istisnası: .planning/ altı kalıcı dokümanlar).

## Pivot Hikayesi (kısa context)

Eskiden gamification (XP, mission, badge) vardı, atıldı. Şimdi yaklaşım:
**"Tek asistan UPU + killer komutlar + Tips sistemi"**. Yeni feature eklerken
"oyunlaştırma değer katar mı?" değil, **"emlakçı/satıcı/sahibe somut iş kazandırır
mı?"** sorusu. Tips günlük kısa öneri akışı (her SaaS'ın kendi tips kategorileri var).

## Memory

Kullanıcının auto-memory dizini: `~/.claude/projects/-home-cagr-claude-telegram-channel/memory/`
— ben (telegram-claude orkestrator) kullanır. Sen (upu-emlak/diğer worker'lar)
kendi conversation context'inde tut, memory dosyası yazma.

Kalıcı kararlar/değişiklikler bu CONVENTIONS.md'ye eklenir.
