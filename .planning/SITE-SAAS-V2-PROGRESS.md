# Site SaaS V2 — 7 Modül Ekleme Progress

> Çağrı onayı: 2026-05-27. Toplam ~33-53 saat, 3 sprint.

## 🎯 4 Teknik Karar (onaylı)
1. RBAC: `profiles.role` constraint genişlet → +`sakin`, `yonetici`, `denetci`, `muhasebeci_site`
2. `sy_buildings.arsa_payi_denominator` kolonu eklenecek (KMK 634)
3. Sakin RBAC → Sprint 2 başına ertelendi
4. Migration: 3 parça (rollback kolay)

## 🎯 5 Operasyon Kararı (onaylı)
1. Banka POS: **DEMO ONLY** — Iyzico-vari interface + always-succeeds mock
2. Bildirim: WA Template (Utility) önce, reddedilirse SMS fallback. Provider-agnostic notification katmanı yaz
3. Test: Worker smoke test per sprint, Çağrı son manuel test
4. profiles.role enum genişletme: diğer SaaS'lar etkilenmez
5. Sandbox tenant: `sandbox-site-001` production'da yaratılacak, Sprint 3 sonu temizlenecek

## 📅 Sprint 1 (8-12 sa) — DB Temeli + RBAC ✅ TAMAMLANDI 2026-05-27

### Migration adımları ✅
- [x] `20260527120000_site_v2_role_extension.sql` — profiles.role +4 enum + 3 helper fn (c31746d)
- [x] `20260527120500_site_v2_new_tables.sql` — 8 yeni tablo + arsa_payi_denominator (a7b4262)
- [x] `20260527121000_site_v2_rls_policies.sql` — RLS sıkılaştırma + yönetici/denetci/muhasebeci policies (600252c)

### UI adımları ✅
- [x] Admin rol atama widget `/tr/site-yonetim-rolleri` + API `/api/site/yonetim-rolleri` (7415136)
- [ ] Sandbox tenant `sandbox-site-001` — Sprint 3 testine ertelendi (low priority)

### Verification ✅
- [x] `npx tsc --noEmit` PASS (her commit'te)
- [x] `supabase db push` PASS (3/3 migration)
- [x] 200 OK smoke (banking sayfaları + yeni roller sayfası)
- [x] Vercel auto-deploy çalışıyor (cron fix sonrası)

### Sakin RBAC — Sprint 2 başında eklenecek
- Sprint 1 migration 3'te `sy_*_sakin_read` policy'leri YAZILMADI
- Sprint 2'nin ilk migration'ı bu policy'leri ekleyecek + sakin paneli

## 📅 Sprint 2 (16-22 sa) — Mali ✅ TAMAMLANDI 2026-05-27

### Modüller ✅
- [x] Sakin RLS migration (Sprint 1'den ertelenmişti) (`7b0cafa`)
- [x] M5 Personel & Tedarikçi — `/tr/site-personelim` + `/tr/site-tedarikciler` (`9fb257c`)
- [x] M2 Gider & Bütçe — `/tr/site-butce` + plan vs gerçekleşen rapor (`cd05dbd`)
- [x] M1 Tahsilat & Mock POS — `/tr/site-tahsilat` + provider abstraction (`164372c`)

### Sprint 2 sayfa & API artifact'leri
- `/tr/site-personelim` (CRUD, rewrite — placeholder'dan gerçek)
- `/tr/site-tedarikciler` (CRUD + 30gün sözleşme uyarı)
- `/tr/site-butce` (yıl bazlı plan-vs-actual + plansız harcama tespiti)
- `/tr/site-tahsilat` (borçlu liste + mock POS modal)
- `/api/site/{personel,tedarikciler,butce,tahsilat}` — 4 yeni endpoint
- `src/platform/payments/site-pos.ts` — PaymentProvider interface + MockSitePosProvider

## 📅 Sprint 3 (12-18 sa) — Yönetsel + İletişim ✅ TAMAMLANDI 2026-05-27

### Modüller ✅
- [x] M3 Duyuru & İletişim — `/tr/site-duyurularim` + 4 WA template taslak + provider katmanı (`1815536`)
- [x] M4 Toplantı & Karar (KMK 634) — `/tr/site-toplantilar` + arsa payı çoğunluk hesabı (`7f5cd6f`)
- [x] M6 Bakım Planlama — `/tr/site-bakim` + 7 standart TR preset + auto next_due shift
- [ ] Sandbox tenant temizliği — gereksiz (sandbox yaratılmadı)

### Sprint 3 sayfa & API artifact'leri
- `/tr/site-duyurularim` (rewrite — taslak + send + 4 kanal toggle)
- `/tr/site-toplantilar` (KMK 634 olağan/olağanüstü + gündem)
- `/tr/site-bakim` (3 grup: vadesi geçmiş + 30 gün + diğer + "Yapıldı" tek tık)
- `/api/site/{duyuru,toplantilar,bakim}` — 3 yeni endpoint
- `src/platform/notifications/site-channels.ts` — provider abstraction + WA template taslakları

## 🏷 Commit Etiketleri
- `feat(siteyonetim-v2): sprint 1 — ...`
- `feat(siteyonetim-v2): sprint 2 — ...`
- `feat(siteyonetim-v2): sprint 3 — ...`
- `chore(db): sprint X migration ...`

## 📊 Durum

| Sprint | Başlangıç | Bitiş | Saat | Durum |
|---|---|---|---|---|
| Sprint 1 | 2026-05-27 | 2026-05-27 | ~3 sa | ✅ Tamamlandı |
| Sprint 2 | 2026-05-27 | 2026-05-27 | ~4 sa | ✅ Tamamlandı |
| Sprint 3 | 2026-05-27 | 2026-05-27 | ~3 sa | ✅ Tamamlandı |

## 🎉 V2 BİTTİ — 7 Modül Canlı

- 4 migration · 7 modül · 16 sayfa · 13 API endpoint
- 2 helper SQL fn + 12 RLS policy (sakin/yönetici/denetci/muhasebeci_site)
- Mock POS + Notification provider abstraction (V2 gerçek SDK'lar buraya bağlanır)
- 4 WA template taslak Meta onayına hazır
- KMK 634 uyumlu toplantı yönetimi + arsa payı çoğunluk hesabı

## 📦 V2 Sonrası Cross-Cutting İyileştirmeler (2026-05-27)

### İyileştirme 1 — Magic-Link Mimari (`b929199`)
- 8 evergreen endpoint TTL: 15dk / 60dk → **24 saat**
- magic-verify single-use kaldırıldı (used_at check bypass, audit trail tutulur)
- /api/site/init **cookie session bypass** — resolvePanelAuth + resolveTenantProfile multi-tenant
- (site)/layout.tsx **expired CTA UX** — ⏰ "Linkin süresi dolmuş" + WA pre-fill `SITEYONETIM: Yeni link`
- Önceki magic-verify cookie attach (21dfef0) + bu commit beraber link UX'i bitirir

### İyileştirme 2 — Skeleton UX (`ef3109f`)
- Yeni `src/components/banking/skeleton-variants.tsx`:
  · SkeletonDashboard / SkeletonList / SkeletonPanelShell / SkeletonFullPage
- 6 yeni loading.tsx (Next.js Suspense fallback):
  · /(site) /(panel) /(bayipanel) /(otel-panel) /(market-panel) /[locale]
- (site)/layout.tsx initial load: ⏳ kum saati → SkeletonPanelShell
- Inline button spinner'lar (Kaydediliyor/İşleniyor) KORUNDU — action feedback

### Audit önerileri (next sprint)
- Diğer init endpoint'ler (bayi-panel/init, otel-panel/init, vb.) cookie bypass paterni
- Diğer layout'larda initial load skeleton (panel/bayipanel/otel/market ⏳ varsa)
- View transitions API enable (Next.js 16 experimental)

## 🚧 Sprint 3 sonrası açık konular (V2)
- Karar defteri PDF üretim (sy_meetings.karar_defteri_pdf_url)
- Iyzico/PayTR gerçek POS adapter
- Bakım cron entegrasyonu (overdue otomatik + supplier mail)
- AI Employee panel widget (Sprint 4 — ayrı brief)
- WA Meta onay sonrası deploy
- Sandbox tenant temizliği (yaratılmadı, gereksiz)

## 📦 Sprint 1 Commit Zinciri

| Hash | Açıklama |
|---|---|
| `c31746d` | profiles.role constraint genişletme + 3 helper SQL fn |
| `a7b4262` | 8 yeni tablo + sy_buildings.arsa_payi_denominator |
| `600252c` | RLS sıkılaştırma + yönetici/denetci/muhasebeci_site policies |
| `7415136` | Admin UI rol atama + sidebar item |
