# Otel SaaS — Uçtan Uca İnşa Planı (Çağrı onayı 2026-06-13)

> Kapsam: "biz yaparız" dediğimiz **6 modül** (kanal yönetimi = Reseliva ortaklığı, bu plana dahil DEĞİL — sonra).
> Felsefe: **"Yapabildiğimizi yaparız"** — olması gerekenleri koy, iyi yapabildiklerimizi kur, gerisi ortak. Gereksiz modül yok (araba parkı/marina/ağır ERP/restoran POS YOK).
> Tasarım dili: **ui-ux-pro-max + Framer Motion** (bayi referans). Çok kiracılık: tenant_id + RLS her tabloda.
> Yürütme: **kesintisiz** — faz faz akıcı ilerle, her faz sonu kısa rapor + checkpoint + DEVAM (benden onay bekleme). Sadece gerçek blokajda dur.

---

## Envanter (mevcut — sıfırdan değil)
ZATEN VAR: `(otel-panel)` → odalar, takvim, rezervasyonlar, konuklar, mesajlar, ödemeler, profil + `otel-cekin` + `otel-precheckin-reminder` cron + `src/platform/agent/` altyapısı + `src/tenants/otel`. **Üstüne tamamlanacak.**

---

## FAZ 1 — PMS çekirdeği (mevcut paneli tamamla)
- Oda tipleri + oda envanteri + müsaitlik mantığı (çift rezervasyon engeli)
- Doluluk takvimi (durum renkleri, tarih aralığı)
- Check-in / check-out akışı + **housekeeping/oda durumu** (temiz/kirli/hazır)
- **Fiyat takvimi** (sezon + gün bazlı fiyat)
- **Gelir raporu** (doluluk %, ADR, toplam gelir)
- **Misafir CRM** (profil, tekrar eden misafir, konaklama geçmişi)

## FAZ 2 — Rezervasyon motoru + Web sitesi
- Booking engine: müsaitlik sorgu → oda seç → tarih → fiyat → ödeme → onay → PMS'e düşer
- Otel web sitesi modülü: çok dilli, galeri, oda tipleri, SEO, rezervasyon CTA → booking engine
- (Caretta'da site var; bu modül greenfield otel için)

## FAZ 3 — KBS + Online Check-in
- Online check-in: misafir varış öncesi kimlik/bilgi girer (mevcut precheckin cron'a bağlan)
- **KBS entegrasyonu** (kimlik bildirim — resmi sistem). Credential gelene kadar **mock/stub** ile tam akışı kur, gerçek bağlantı credential gelince.

## FAZ 4 — Tahsilat
- Ödeme: sanal POS / Mollie / iyzico (mevcut Mollie altyapısı varsa üzerine)
- Kapora / depozito akışı
- **e-Fatura/e-Arşiv** entegratörü — hesap gelene kadar mock, akışı kur
- Dekont / IBAN takibi + no-show/kapora hatırlatma kancaları

## FAZ 5 — AI Asistan (5 eleman)
**Altyapı:** agent_* (konuşma + bilgi bankası + **onay kuyruğu** + log) + **Caretta Firestore adaptörü** + onay paneli ekranı + bilgi bankası ekranı + WA Business bağlama.
**Çekirdek (önce):**
1. Direkt Rezervasyon Asistanı (WA/web → müsaitlik+fiyat → "pending" rez → sahibi onay)
2. İtibar (Google yorum → kişiye özel/dil-eşli taslak → onayla yayınla) — GBP OAuth gelince bağlan, mock ile kur
3. Misafir İletişim (varış öncesi/sonrası + 7/24 soru-cevap) — WA template onayı gelince bağlan
**İkinci dalga:**
4. Fiyatlama (doluluk+sezon → fiyat önerisi; FAZ 1 fiyat takvimine bağlı)
5. Tahsilat elemanı (FAZ 4 ödeme altyapısına bağlı)
**Pilot güvenlik:** her giden mesaj onay kuyruğundan geçer.

## FAZ 6 — Uçtan uca test (en son, Çağrı ile birlikte)
- Tüm modüller entegre senaryo testi (rezervasyon → check-in → KBS → tahsilat → asistan)
- Build temiz + tüm canlı sayfalar 200
- Çağrı ile birlikte son kullanıcı testi

---

## Çapraz kesen (her fazda)
- tenant_id + RLS, auth guard (her route ilk satır), ui-ux-pro-max + Framer Motion
- Her faz sonu: build + canlı 200 + bu dosyaya **checkpoint** (faz durumu) + kısa rapor → DEVAM

## Dış erişim (mock ile geliştir, gerçek gelince bağla — blokaj değil)
- [ ] KBS credential/kayıt · [ ] e-Fatura entegratör hesabı · [ ] GBP OAuth · [ ] WA Business template onayı

## Checkpoint (worker günceller)
- FAZ 1: ✅ (2026-06-13) — DB: otel_price_calendar + 4 RPC (müsaitlik, fiyat hesap, rollup) + guest stay trigger. API: calendar, reservations CRUD, rooms CRUD, housekeeping CRUD, price-calendar, revenue-report, guest detail. UI: doluluk takvimi (oda×30gün), rezervasyon ekle/check-in/check-out/iptal, oda ekle/düzenle/sil, housekeeping web sayfası, fiyat takvimi (sezon override), gelir raporu (ADR/RevPAR/kaynak), misafir CRM detay (lifetime stats+geçmiş). Sidebar 3 yeni link. Canlı: hotelai.upudev.nl/tr/otel-{takvim,gelir,housekeeping,fiyat} hepsi 200. Commit c96f6f2.
- FAZ 2: ✅ (2026-06-13) — DB: otel_hotels.slug + public_settings JSONB + web_published. API: /api/public/otel/[slug] (landing data), /availability (boş oda+fiyat), /book (rez talep). /api/otel-panel/website (GET/PATCH). UI: /[locale]/o/[slug] public landing (hero+oda tipleri+galeri+olanaklar+iletişim), /rezervasyon (3-step booking form), /onay/[id] (başarı). Sahibi yönetim: otel-website sayfası (slug+yayın+hero+galeri+olanaklar+iletişim). Sidebar +Web Sitesi link. Canlı: hotelai.upudev.nl/tr/otel-website 200. Commit 102a6f6.
- FAZ 3: ✅ (2026-06-13) — DB: otel_pre_checkins +KBS kimlik alanları (tc_no/birth_date/nationality/mother/father/id_type/id_number/gender) + otel_kbs_submissions tablosu (status enum: pending/sent/accepted/rejected/failed + payload/kbs_response/kbs_reference). Mock client (src/platform/kbs/mock-client.ts): %85 accept / %10 pending / %5 reject ağırlıklı, 200ms latency, validation hatası simülasyonu. API: GET/POST /api/otel-panel/kbs (list + submit), POST/DELETE /api/otel-panel/kbs/[id] (resubmit/delete). UI: otel-kbs (KPI özet + bildirim bekleyenler + filter chips + gönderim listesi + resubmit/delete butonları + MOCK uyarı banner). Misafir formu (otel-cekin) +KBS kimlik bölümü (tc/pasaport toggle + birth_date + nationality + parents + gender). Otomatik submit: misafir formu kaydedince mock KBS gönderim. Sidebar +KBS link.
- FAZ 4: ⏳ · FAZ 5: ⏳ · FAZ 6: ⏳ (Çağrı testi)
