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

## 📅 Sprint 1 (8-12 sa) — DB Temeli + RBAC

### Migration adımları
- [ ] 20260527120000_site_v2_role_extension.sql — profiles.role constraint + helper SQL fn
- [ ] 20260527120500_site_v2_new_tables.sql — 8 yeni tablo + arsa_payi_denominator
- [ ] 20260527121000_site_v2_rls_policies.sql — 16 tablo × 4 katman RLS

### UI adımları
- [ ] Admin rol atama widget (`/tr/site-yonetim-rolleri`)
- [ ] Sandbox tenant `sandbox-site-001` yarat + demo verisi

### Verification
- [ ] `npm run build` PASS
- [ ] `supabase db push` PASS
- [ ] 5 dakika smoke (her tablo INSERT/SELECT)
- [ ] Vercel deploy Ready

## 📅 Sprint 2 (16-22 sa) — Mali

### Modüller
- [ ] Modül 1: Tahsilat & Banka POS (mock) — `/tr/site-tahsilat`
- [ ] Modül 2: Gider & Bütçe — `/tr/site-butce`
- [ ] Modül 5: Personel & Tedarikçi — `/tr/site-personel-detay`, `/tr/site-tedarikciler`
- [ ] Sakin RBAC final test

## 📅 Sprint 3 (12-18 sa) — Yönetsel + İletişim

### Modüller
- [ ] Modül 3: Duyuru & İletişim — `/tr/site-duyuru-yonetim` + WA template taslakları
- [ ] Modül 4: Toplantı & Karar (KMK 634) — `/tr/site-toplantilar`
- [ ] Modül 6: Bakım Planlama — `/tr/site-bakim-takvim`
- [ ] Sandbox tenant temizliği

## 🏷 Commit Etiketleri
- `feat(siteyonetim-v2): sprint 1 — ...`
- `feat(siteyonetim-v2): sprint 2 — ...`
- `feat(siteyonetim-v2): sprint 3 — ...`
- `chore(db): sprint X migration ...`

## 📊 Durum

| Sprint | Başlangıç | Bitiş | Saat | Durum |
|---|---|---|---|---|
| Sprint 1 | 2026-05-27 | — | — | 🟡 Başlatılıyor |
| Sprint 2 | — | — | — | ⏳ Bekliyor |
| Sprint 3 | — | — | — | ⏳ Bekliyor |
