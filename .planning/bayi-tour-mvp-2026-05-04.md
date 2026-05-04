# Bayi Tour MVP — 2026-05-04

Pipeline mode plan — koridor mantığında AI-led tour + web-first detay panel.

## Faz 1 — Bug Fix (~30 dk) ✅
- [x] 1.1 Demo seed "veri mevcut" mesajı sadeleştir → "✅ Veriler yüklendi. Şimdi devam edelim."
- [x] 1.2 "Tour'u Atla" butonu kaldır + skipBayiTour dead code temizle
- [x] 1.3 Tour push'larında skipNav kontrol (intro mesaj + 7 task)
- [x] 1.4 Komut handler cevap sonrası tour aktifken nav kalabalığı kaldır
       (AsyncLocalStorage withNavSuppressed wrapper)

**Commit**: `86e4d0c` — fix(tour): demo seed mesajı + Tour'u Atla kaldır + nav koridor suppression

## Faz 2 — Bayi Liste Web Panel (~3-4 sa) ✅
- [x] 2.1 /bayilerim WA cevabı: kısa mesaj + CTA URL `[📋 Bayi Listesini Aç]`
- [x] 2.2 /api/bayiler/list: magic-link auth + paginated query (page/q/filter)
- [x] 2.3 /api/bayiler/init: token doğrulama + tenant context
- [x] 2.4 src/app/[locale]/bayiler/page.tsx — client component, URL state'li
- [x] 2.5 Liste row tasarımı: avatar (baş harfli renk-kodlu), isim+badge, şehir+telefon+yetkili, bakiye+son sipariş, 3 hızlı aksiyon (WA/Ara/detay)
- [x] 2.6 Arama (debounced 350ms) + status/vade filtre dropdown
- [x] 2.7 Pagination + sayfa boyutu (10/20/50)

**Commit**: `babe2d1` — feat(panel): bayi listesi web panel + paginated + filtre

## Faz 3 — Bayi Detay Sayfası (~6-8 sa)
- [ ] 3.1 /bayiler/[id]/page.tsx — magic-link auth + 3-sütun layout
- [ ] 3.2 Üst özet kartı (avatar/logo, isim, kontak, etiket, durum dropdown)
- [ ] 3.3 Sol panel — Finansal (bakiye, kredi limiti, vade, son ödeme, mini grafik)
- [ ] 3.4 Orta panel — Sipariş geçmişi tablosu + filtre + "Yeni Sipariş"
- [ ] 3.5 Sağ panel — Timeline (WA, AI, notlar)
- [ ] 3.6 Sticky aksiyon butonları
- [ ] 3.7 Aksiyon modalleri:
  - WA Mesaj Gönder (şablon + AI assist)
  - Vade Hatırlatma (hazır şablon)
  - Not Ekle
  - Özel Kampanya (form + WA bildirim)
  - Yeni Sipariş (multi-step)
  - Düzenle (form)
  - Durum Değiştir (dropdown)
  - Sil (soft, onaylı)
- [ ] 3.8 Belgeler tab
- [ ] 3.9 Kampanyalar tab

**Commits**:
- `feat(panel): bayi detay sayfası + finansal/timeline/aksiyonlar`
- `feat(panel): bayi detay aksiyon modalleri (WA/vade/not/kampanya/sipariş/düzenle/durum/sil)`
- `feat(panel): bayi detay belgeler + kampanyalar tab`

## Faz 4 — Tour Flow Web-First Revize (~1-2 sa)
- [ ] 4.1 Task 1 — bayilerim → CTA URL liste sayfası
- [ ] 4.2 Task 2 — kullanıcı kritik bayiye tıklar → detay açılır + tour banner
- [ ] 4.3 Task 3 — Vade Hatırlatma butonu highlighted → modal → mock send → Task 4 trigger
- [ ] 4.4 Task 4-7 basitleştirilmiş (sonraki tur için tam web-first)

**Commit**: `feat(tour): web-first revize (Task 1-3 detay akışı)`

## Faz 5 — Polish + Deploy (~30 dk)
- [ ] 5.1 Build (tsc + eslint)
- [ ] 5.2 Demo data adequacy
- [ ] 5.3 Mobile responsive
- [ ] 5.4 Prod deploy
- [ ] 5.5 Test akışı raporu

---

## Live Commit Tracking
Her commit hash'i hemen buraya:

| Faz | Commit | Konu |
|-----|--------|------|
| 1   | TBD    | Bug fix bundle |
| 2   | TBD    | Bayi liste panel |
| 3a  | TBD    | Bayi detay sayfası |
| 3b  | TBD    | Aksiyon modalleri |
| 3c  | TBD    | Belgeler + kampanyalar tab |
| 4   | TBD    | Tour web-first revize |
| 5   | TBD    | Polish |

## Kararlar / Kısıtlar
- **Koridor**: çıkış yok, atla yok, geri dön yok
- **Logo adapter implementasyonuna BAŞLAMA** — sadece scaffold
- **Demo modu** (`NEXT_PUBLIC_DEMO_MODE=true`) tüm yeni feature'larda respect
- **Aksiyonlar mock**: WA Cloud API gerçek hit etmez, toast döndür + timeline'a kayıt
- **Sahip-only**: sahip kontrolü her endpoint + sayfada
- **Magic link**: 7 gün TTL (bayi-profil pattern'i)
