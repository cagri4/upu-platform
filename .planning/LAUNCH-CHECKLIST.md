# LAUNCH-CHECKLIST — UPU SaaS Production Açma Gate

Bu liste her SaaS'ı paying customer'a açmadan (reklam yayını + signup gerçek müşteriye açılması) önce TAMAMLANMASI ŞART olan kontrolleri içerir. Bir madde işaretsiz kalırsa o SaaS production'a açılmaz, reklam görmez.

> **Bu liste yalnızca yeni SaaS değil, MEVCUT SaaS'lar için de geçerlidir.** UPU başlangıçta tek-tenant kuruluşunun kalıntıları nedeniyle 2026-06-01 tarihinde geriye dönük denetim başlatıldı. Her SaaS bu listeyi geçene kadar "trial mode" — kayıt açık ama reklam kapalı.

## İlişkili dokümanlar

- `ADD-NEW-SAAS.md` — yeni SaaS açma recipe'i (14 adım)
- `ARCHITECTURE.md` — UPU mimari kararları
- Root `CLAUDE.md` + her SaaS'ın kendi `src/tenants/{name}/CLAUDE.md`'si

## Sorumluluk anahtarı

- 👤 **Çağrı** — yönetim onayı / iş kararı
- 🤖 **Worker** — kod fix / migration / test
- 🏛️ **3. taraf** — pentest firması, hukuk müşaviri, vs.

---

## 1. Multi-tenant izolasyon (DB seviyesi)

**Ne:** Her tenant'ın verisi diğer tenant'lardan tamamen izole olmalı. Şu an UPU 7 SaaS'ta tek tenant + her signup aynı havuza düşüyor — bu CIDDI bir açık.

- [ ] organic-signup.ts yeni signup için yeni `tenants` satırı INSERT ediyor (task #100)
- [ ] `/api/auth/otp/verify` signup branch'i de aynı logic kullanıyor
- [ ] DB'de yeni signup test: yeni tenant_id yaratılıyor, eski demo tenant'a yazılmıyor
- [ ] Yeni signup ile sanal telefon: panelde 0 veri görülüyor (demo veri sızıntısı yok)
- [ ] Eski "Bayi Yönetimi/Emlak Ofisi/..." tenant'ları UPU Dev demo tenant olarak korunuyor

**Kontrol:** Sanal telefonla 2 SaaS signup → DB sorgu `SELECT count(*) FROM tenants WHERE saas_type=X` (≥2 olmalı, sadece 1 olursa açık var)

**Sorumluluk:** 🤖 task #100

---

## 2. RLS (Row Level Security) — DB katmanı zorlaması

**Ne:** Supabase RLS politikaları her `tenant_id`'li tabloda zorlamalı. Kod bir filter atlasa bile DB engellesin. Multi-tenant SaaS altın kural.

- [ ] Her tenant_id'li tabloda RLS enabled
- [ ] Policy: `tenant_id = (SELECT tenant_id FROM profiles WHERE auth_user_id = auth.uid())` veya benzeri
- [ ] Service role bypass'lı endpoint'lerde manuel guard hala var (RLS service role'ü bypass eder)
- [ ] Test: anonim/farklı tenant cookie ile direct REST API çağrısı → 0 satır

**Kontrol:** `SELECT * FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'bayi_%';` her tabloya policy

**Sorumluluk:** 🤖 ayrı task (4-5 saat)

**Referans:** task #47 sanat-galeri RLS pattern var, oradan örnek alınabilir

---

## 3. API endpoint izolasyon audit

**Ne:** Tüm API endpoint'lerinde `tenant_id` (multi-tenant) + `property_id` (otel multi-property) + `user_id` (multi-user marka içi) filter'larının her query'de uygulandığı doğrulansın.

- [ ] Tüm `/api/*/route.ts` dosyaları grep ile taransın (auth chain mevcut mu)
- [ ] Multi-property otel endpoint'lerinde `property_id` zorunlu
- [ ] Cross-tenant veri okuma sadece izinli yerlerde (muhasebe vergi `is.null` istisnası gibi)
- [ ] WA agent context'lerinde `ctx.tenantId` filter eksiksiz

**Kontrol:** Worker subagent ile sistematik tarama, çıkan açıklar fix edilsin

**Sorumluluk:** 🤖 worker subagent (3-4 saat)

---

## 4. Platform admin guard

**Ne:** Platform admin koşulu `role='admin' AND tenant_id IS NULL`. Tenant sahibi (`role='admin' AND tenant_id IS NOT NULL`) platform admin'e erişememeli.

- [x] AdminGroupLayout `tenant_id IS NULL` şartı (commit 8d13558)
- [x] requireAdminUser aynı şart (commit 8d13558)
- [x] Çağrı'nın profilinin `tenant_id` NULL
- [x] Doğuş tip kullanıcı 403 alıyor (test ile kanıtlandı)
- [ ] Yeni platform admin atama yolu var mı? (manuel migration vs admin paneli)

**Kontrol:** Test ile JWT imzalayıp Doğuş cookie'siyle /api/admin/stats → 403

**Sorumluluk:** ✅ tamamlandı

---

## 5. Auth guard her endpoint'te

**Ne:** Her admin/dashboard/sensitive endpoint İLK satırda `requireAuth` veya `requireAdminUser`. Bypass edilebilen endpoint olmasın.

- [x] /cso 6 kritik açık 2026-05-28 fix (commit 14e304b)
- [ ] Yeni endpoint eklenirken otomatik kontrol (CI lint rule?)

**Kontrol:** Endpoint'leri grep ile tarama, ilk satırda guard yoksa rapor

**Sorumluluk:** 🤖 ayrı task — CI lint rule

---

## 6. CI'de otomatik izolasyon testi

**Ne:** Her PR'da otomatik 2-kullanıcı izolasyon testi. Kırmızı = merge engelli.

- [ ] Test framework kurulumu (Vitest/Playwright)
- [ ] Test senaryosu yazılı: User A signup → kayıt yarat → User B signup → A'nın kaydı görünmüyor (B 0 sonuç veya 403)
- [ ] GitHub Actions workflow aktif
- [ ] Branch protection rule: test geçmeden merge yok

**Kontrol:** PR aç + fail edecek bir izolasyon ihlali commit → CI kırmızı yapmalı

**Sorumluluk:** 🤖 ayrı task (4-6 saat)

---

## 7. Demo data temizlik

**Ne:** Production deploy öncesi demo seed verisi (5 dealer "Kalfa Boya", vs.) müşteri tenant'larında olmamalı. Demo veri SADECE UPU Dev'in demo tenant'ında.

- [ ] `/api/bayi-demo/clear` endpoint'i her SaaS'a yayılmış mı? (emlak/market/otel/restoran/site)
- [ ] Demo tenant ile prod tenant net ayrı (yeni signup demo'ya yazmıyor — Madde 1)
- [ ] Demo göster akışı için ayrı bir mekanizma var (Çağrı "demo göster" derken hangi tenant'a gidiyor?)

**Kontrol:** Yeni signup yapan kullanıcı panelinde 0 demo veri görmeli

**Sorumluluk:** 🤖 worker — task #100 ile birlikte

---

## 8. KVKK / GDPR compliance

**Ne:** Hollanda piyasası GDPR sıkı. Aydınlatma metni multi-tenant durumunu yansıtmalı, veri ihlali bildirimi flow'u olmalı, audit log altyapısı kurulmalı.

- [ ] Aydınlatma metni `/aydinlatma-metni` güncel multi-tenant durumu
- [ ] KVKK consent (kayıt sırasında implicit consent var, Madde 7.0 emlak'tan)
- [ ] Veri ihlali bildirim flow (breach notification — 72 saat içinde kullanıcı uyarısı)
- [ ] Audit log: kim hangi veriye eriştirildi (eklenmeli)
- [ ] Veri silme talebi flow (GDPR right to erasure)

**Kontrol:** Hukuk müşaviri ile yıllık review

**Sorumluluk:** 👤 Çağrı + 🏛️ hukuk müşaviri

---

## 9. Subdomain + cookie izolasyonu

**Ne:** Cookie `.upudev.nl` domain'de paylaşımlı. Bir SaaS'ta giriş yapan kullanıcı diğer SaaS subdomain'lerinde de aktif görünür. Auth gate'i daima `profile + tenant + saas_type` kombinasyonu ile yapılmalı.

- [x] Subdomain → tenant resolve middleware'de
- [ ] Cookie session'da tenant_id var, ama farklı tenant subdomain'de aktif olunca ne oluyor doğrulansın
- [ ] Bayi cookie → emlak subdomain'e gidince guard çalışıyor mu (cross-SaaS izolasyon)

**Kontrol:** Manuel test — bayi cookie ile estateai.upudev.nl/tr/panel'e git, 403 dönmeli

**Sorumluluk:** 🤖 worker — Madde 3 audit içine dahil

---

## 10. Penetration test (3. taraf)

**Ne:** İç çalışma yetmez — son denetim profesyonel pentest. KVKK/GDPR yararına yatırım, satış engelleme noktası.

- [ ] Pentest firması seçimi (Hollanda piyasası standart: ~€2-5k)
- [ ] Madde 1-9 tamamlandıktan SONRA yapılsın (yoksa 100+ bulgu kaos)
- [ ] Rapor alındıktan sonra düzeltme planı + tekrar pentest
- [ ] Compliance dokümantasyonu yatırımcı/müşteri sunumu için

**Kontrol:** Pentest raporu — Critical 0, High ≤3 olmalı

**Sorumluluk:** 👤 Çağrı (bütçe + firma seçimi) + 🤖 worker (fix uygulama)

**Zamanlama:** Madde 1-9 bittikten ~2-3 hafta sonra. Çağrı bütçe netleştiğinde başlatır.

---

## Statü Tablosu

| # | Konu | Statü | Son güncelleme |
|---|------|-------|----------------|
| 1 | Multi-tenant izolasyon (DB) | 🟡 in_progress (task #100) | 2026-06-01 |
| 2 | RLS politikaları | 🔴 yok | 2026-06-01 |
| 3 | API endpoint audit | 🔴 yok | 2026-06-01 |
| 4 | Platform admin guard | 🟢 done | 2026-06-01 (commit 8d13558) |
| 5 | Auth guard her endpoint | 🟡 kısmi (CI rule yok) | 2026-05-28 (commit 14e304b) |
| 6 | CI izolasyon testi | 🔴 yok | 2026-06-01 |
| 7 | Demo data temizlik | 🟡 in_progress (task #100 ile) | 2026-06-01 |
| 8 | KVKK/GDPR compliance | 🟡 kısmi | 2026-06-01 |
| 9 | Subdomain + cookie izolasyon | 🟡 kısmi | 2026-06-01 |
| 10 | Pentest | 🔴 yok | 2026-06-01 |

Yeşil madde = "o SaaS reklam görebilir". Tüm maddeler yeşil olmadan production reklamı yok.

---

## Güncelleme kuralı

Her maddede iş tamamlandığında statü güncellensin (🔴→🟡→🟢) + son güncelleme tarihi yazılsın. Bir madde geri açılırsa (örn yeni regression bug) tekrar 🔴 yapılır.

Yeni SaaS açma sırasında ADD-NEW-SAAS.md'nin Kontrol Listesi kısmında "LAUNCH-CHECKLIST.md tüm maddeler yeşil mi?" satırı zorunlu kontrol.
