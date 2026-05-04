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

## Faz 3 — Bayi Detay Sayfası (~6-8 sa) ✅
- [x] 3.1 /bayiler/[id]/page.tsx — magic-link auth + 3-sütun layout
- [x] 3.2 Üst özet kartı (avatar baş harf, isim, kontak, etiket, kayıt tarihi)
- [x] 3.3 Sol panel — Finansal (bakiye, kredi limiti progress, vade, son ödeme)
- [x] 3.4 Orta panel — Sipariş geçmişi tablosu + status badge + "Yeni Sipariş"
- [x] 3.5 Sağ panel — Timeline (notlar + WA + ödemeler + siparişler birleşik)
- [x] 3.6 Sticky aksiyon butonları (8 buton + Ara)
- [x] 3.7 Aksiyon modalleri (8 modal mock-first):
  - WA Mesaj Gönder (5 şablon + textarea + {AD}/{TUTAR}/{GUN} substitusyon)
  - Vade Hatırlatma (auto-doldurulan AI şablon)
  - Not Ekle (textarea + timeline'a kayıt)
  - Özel Kampanya (ad + tip + tutar + tarih + WA bildirim checkbox)
  - Yeni Sipariş (multi-kalem + canlı toplam)
  - Düzenle (firma bilgileri formu)
  - Durum Değiştir (radio: aktif/dondurulmuş/pasif)
  - Sil (soft delete, "SIL" onay yazımı)
- [ ] 3.8 Belgeler tab — sonraki tur
- [ ] 3.9 Kampanyalar tab — sonraki tur

**Commits**:
- `95c86d3` — feat(panel): bayi detay sayfası iskelet
- `982f077` — feat(panel): bayi detay aksiyon modalleri (8 modal — mock-first)

## Faz 4 — Tour Flow Web-First Revize (~1-2 sa) ✅
- [x] 4.1 Task 1 — liste sayfası açılışında tour_bayilerim_done advance
- [x] 4.2 Task 2 — detay sayfasında kritik bayi ise tour_kritik_bayi_done advance + tour banner
- [x] 4.3 Task 3 — Vade Hatırlatma submit'inde tour_urunler_done advance
- [x] 4.4 /api/tour/advance endpoint (magic-link auth + advanceDiscovery)
- [ ] 4.5 Task 4-7 web-first (sonraki tur) — şu an WA komut tabanlı

**Commit**: `10740e4` — feat(tour): web-first revize (Task 1-3 detay akışı)

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
| 1   | `86e4d0c` | Bug fix bundle (demo seed + Tour Atla + nav suppression) |
| 2   | `babe2d1` | Bayi liste panel (paginated + filtre) |
| 3a  | `95c86d3` | Bayi detay sayfası iskelet |
| 3b  | `982f077` | Aksiyon modalleri (8 mock-first modal) |
| 3c  | sonraki tur | Belgeler + kampanyalar tab |
| 4   | `10740e4` | Tour web-first revize (Task 1-3) |
| 5   | (bu commit) | Polish — plan güncelleme |

## Kararlar / Kısıtlar
- **Koridor**: çıkış yok, atla yok, geri dön yok
- **Logo adapter implementasyonuna BAŞLAMA** — sadece scaffold
- **Demo modu** (`NEXT_PUBLIC_DEMO_MODE=true`) tüm yeni feature'larda respect
- **Aksiyonlar mock**: WA Cloud API gerçek hit etmez, toast döndür + timeline'a kayıt
- **Sahip-only**: sahip kontrolü her endpoint + sayfada
- **Magic link**: 7 gün TTL (bayi-profil pattern'i)
