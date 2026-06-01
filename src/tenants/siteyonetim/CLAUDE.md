# Site Yönetimi SaaS — CLAUDE.md

Bu dosya siteyonetim tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Site Yönetimi SaaS — apartman/site (KMK 634 kapsamı) yönetimi. Aidat takibi, bütçe, duyuru, bakım, personel, banka sanal POS entegrasyonu. Subdomain: residenceai.upudev.nl (siteyonetim için; estateai = emlak). V2 geliştirme devam (task #87, 7 modül ekleniyor).

## Pattern'ler

**Route group:** `src/app/[locale]/(site)` — site yönetim panel sayfaları:
- `site-aidat` — aidat takibi
- `site-ayarlari` — yönetim ayarları
- `site-bakim` — bakım talepleri
- `site-butce` — yıllık/aylık bütçe
- `site-duyurularim` — duyurular
- `site-personelim` — kapıcı/güvenlik
- `site-profil` — site profili
- `site` — ana sayfa/dashboard

**Subdomain:** residenceai.upudev.nl. Tenant header `x-tenant-key=siteyonetim`.

**Auth:** Cookie session öncelikli + token fallback.

**KMK 634 uyumu:** Yasal çerçeve — KMK (Kat Mülkiyeti Kanunu) Madde 634 site yönetim sorumluluklarını tanımlar. Aidat/bütçe/yıllık genel kurul yapısı bu yasa kapsamında.

**Banka sanal POS:** Aidat tahsilatı için entegre.

## Sınırlar (UPU genel)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS.
- **profiles.tenant_id NOT NULL** site profili.
- **role='admin' = TENANT SAHİBİ** (site yöneticisi/yönetim kurulu üyesi).
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Multi-tenant route group zorunlu** — `(site)` (memory: feedback-multi-tenant-route-groups).
- **PWA YOK**.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — cookie öncelikli + token fallback ZORUNLU.
- ❌ **API route auth eksik** — her admin endpoint İLK satırda guard.
- ❌ **Emlak/bayi şablonundan link kalıntısı** — site emlak'tan port edildi, "Yeni ilan", "Mülk satış" gibi link/metin sızabilir. Grep audit gerekli.
- ❌ **Site sakini ↔ yönetici karışıklığı** — site sakini düşük capability, yönetim kurulu üyesi/yönetici farklı. role + capability sıkı tutulmalı.
- ❌ **Mock database test**.

## Bilinen iyi pattern'ler

- Banking style port (task #83 in_progress, emlak Faz 5.x'ten).
- KMK 634 uyumlu aidat/bütçe yapısı.
- Banka sanal POS aidat tahsilat.
- Duyuru/bakım/personel kategori bazlı modüler yapı.

## İlgili planning dosyaları (pointer)

- `.planning/SITE-SAAS-V2-PROGRESS.md` — V2 sprint progres (7 modül ekleme planı)
- `.planning/ARCHITECTURE.md` — UPU genel mimari

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit, sayısal durum YAZMA.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
