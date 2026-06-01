# Muhasebe SaaS — CLAUDE.md

Bu dosya muhasebe tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Muhasebe SaaS — küçük işletme/serbest meslek için muhasebe asistanı. Vergi sorgu/hesap, e-fatura takip, defter işlem, gider/gelir, KDV bildirim hazırlık. WhatsApp odaklı — vergi uzmanı agent + komut sistemi (`vergi.ts`, `vergi-uzmani.ts`). Subdomain: accountai.upudev.nl. Şu an WA-first MVP; web panel sonra eklenecek.

## Pattern'ler

**Agent + commands odaklı:** `src/tenants/muhasebe/agents/vergi-uzmani.ts` + `src/tenants/muhasebe/commands/vergi.ts`. WA üzerinden vergi sorgusu, asistan yanıt verir.

**Cross-tenant veri okuma:** Vergi/oran/yasa verisi `tenant_id IS NULL` ile global tutuluyor (`or(tenant_id.eq.${tenantId},tenant_id.is.null)` pattern'i). Bu bilinçli — vergi kuralları platform-wide.

**Subdomain:** accountai.upudev.nl. Tenant header `x-tenant-key=muhasebe`.

**Web panel:** Henüz route group yok. Eklenirken `(muhasebe-panel)` route group açılmalı, generic `(panel)` KULLANMA.

**Auth:** Cookie session öncelikli + token fallback. WA agent için ayrı (WA webhook → router → muhasebe agent).

## Sınırlar (UPU genel + muhasebe)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS.
- **profiles.tenant_id NOT NULL** muhasebe profili.
- **role='admin' = TENANT SAHİBİ** (işletme sahibi/muhasebeci).
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Vergi verisi platform-wide** — `tenant_id IS NULL` global kayıtlar VAR (vergi oranları, KDV kuralları). Bunlar tenant'a bağlı değil, herkesin okuduğu paylaşım veri.
- **PWA YOK**.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Vergi sorgusunda tenant_id eq filter ATILIRSA** — global vergi verisi gözükmez. `or(tenant_id.eq.X,tenant_id.is.null)` pattern'i ŞART.
- ❌ **Token-only init/save endpoint** — web panel eklendiğinde cookie öncelikli + token fallback ZORUNLU.
- ❌ **API route auth eksik** — her admin endpoint İLK satırda guard.
- ❌ **Yanlış vergi/oran bilgisi** — agent yanıtı vergi hesabı içeriyorsa kaynak veri DB'den çekilmeli, uydurma yasak. Yasal sorumluluk.
- ❌ **Hatasız fatura uydurma** — agent e-fatura/defter işlemde verisi yoksa "bilmiyorum, kullanıcıya teyit ettir" deyişi şart, halüsinasyon = legal risk.
- ❌ **Mock database test**.

## Bilinen iyi pattern'ler

- **Platform-wide veri + tenant veri ayrımı** — `tenant_id IS NULL` pattern'i (vergi/oran/yasa).
- **WA-first MVP** — web panel olmadan da kullanılabilir.
- **Agent + komut sistemi** — vergi uzmanı + vergi komutu.

## İlgili planning dosyaları (pointer)

- `.planning/ARCHITECTURE.md` — UPU genel mimari (muhasebe için ayrı planning yok yet)

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit, sayısal durum YAZMA.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.
- ⚠️ Vergi/yasal kapsamlı kural değişikliklerini ÖNCE Çağrı'ya teyit ettir — yasal sorumluluk.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
