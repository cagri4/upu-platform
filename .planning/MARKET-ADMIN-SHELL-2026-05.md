# Market Admin Shell + Warm Welcome — Replikasyon Planı (2026-05-07)

Emlak Gold Standard pattern'inin (`EMLAK-ADMIN-SHELL-2026-05.md`) market'a port'u.
Kapsam: admin shell (sidebar + topbar + dashboard) + warm welcome 3-mesaj.

## 1. Kapsam Özeti

**Yapılacak (sadece market namespace):**
- `src/app/[locale]/(market-panel)/...` — yeni route group (emlak `(panel)` ile çakışmayan izole alan)
- `src/app/api/market/...` — yeni API endpoint'leri (init / dashboard / start / web-sitem / stok / profil)
- `src/app/[locale]/market-profilim/page.tsx` — shell DIŞI form sayfası
- `src/tenants/market/intro.ts` — startMarketIntro (warm welcome 3 mesaj)
- `src/platform/whatsapp/intro.ts` — minimal hook (INTRO_TENANTS + branch + import)

**Dokunulmaz (paralel tmux çakışmasını önle):**
- `src/components/admin-layout.tsx` — generic, sadece prop ile kullanılır
- `src/app/[locale]/(panel)/...` — emlak'a özel
- `src/app/api/panel/...` — emlak'a özel
- Diğer tenant'ların dosyaları (bayi, otel, restoran, site)
- Market WA komutları (30 komut + 3 agent + onboarding-flow.ts) — sapasağlam kalır

## 2. Brief'teki Kullanıcı Onayları (2026-05-07 cevap dosyası)

| # | Karar |
|---|-------|
| 1 | Sidebar 7-item (Personel YOK) |
| 2 | KPI 6'ya tamamla: bugün ciro / stok kritik / bekleyen sipariş / bu ay tedarikçi / aktif sadakat + **sadık üye sayısı** |
| 3 | Route group: `(market-panel)` (brief'teki `(admin)` typo, izole namespace tercih edildi) |
| 4 | Sayfa scope **B**: Dashboard + Stok + Profil önemli; diğer 4 placeholder "Yakında". Daralma olursa Stok+Profil minimum |
| 5 | MVP A "Sadık Müşterim" CRM sonraki turda bu shell üstüne inşa |

## 3. Yeni Sidebar (10 item — emlak Bölüm 11 yeni Panelim pattern'ine göre)

```
1.  🏠 Panelim                    → /tr/market-panelim
2.  📦 Stok                       → /tr/market-stok
3.  🚚 Tedarikçiler               → /tr/market-tedarikciler           (placeholder)
4.  📥 Tedarikçi Siparişleri      → /tr/market-tedarikci-siparisleri  (placeholder)
5.  💛 Müşteri Sadakati           → /tr/market-musteri-sadakati       (placeholder)
6.  🧾 Kasa Raporu                → /tr/market-kasa-raporu            (placeholder)
7.  👤 Profilim                   → /tr/market-profilim               (form, shell DIŞI)
─────────────────────── separatorBefore: true
8.  ℹ️  UPUDev Hakkında            → /tr/market-hakkinda
9.  💬 Öneri / Şikayet            → /tr/market-oneri                  (placeholder)
10. 🛟 Destek Talebi              → /tr/market-destek                 (placeholder)
─────────────────────── (logout footer)
    💬 WhatsApp'a Dön             → handleLogout
```

`brandTitle="🛒 UPU Market"`, `brandIconCollapsed="🛒"`, `accentColor="amber"`.

## 4. KPI Listesi (Dashboard — 8 kart)

| # | Anahtar | Etiket | Kaynak | Renk gradient |
|---|---------|--------|--------|---------------|
| 1 | `daily_revenue` | Bugünkü Cironuz | `mkt_sales` sum(total_amount) where sold_at>=todayStart | indigo→blue |
| 2 | `low_stock_count` | Kritik Stoklarınız | `mkt_products` count where quantity<=COALESCE(min_stock,10) | rose→pink |
| 3 | `pending_orders` | Bekleyen Siparişleriniz | `mkt_orders` count where status IN ('pending','confirmed') | amber→orange |
| 4 | `monthly_suppliers` | Bu Ay Tedarikçileriniz | `mkt_orders` distinct supplier_id where created_at>=monthStart | emerald→teal |
| 5 | `active_promotions` | Aktif Sadakat Kampanyaları | `mkt_promotions` count where active=true (yoksa 0) | violet→fuchsia |
| 6 | `loyalty_members` | Sadık Üye Sayınız | `mkt_loyalty_customers` count (yoksa 0 — Faz 2'de gerçekleşir) | sky→cyan |
| 7 | `profil` | Profilim | static "Düzenle" | stone→stone-800 |
| 8 | `websitem` | Web Sitem | metadata.market_profili.web_slug var/yok | teal→emerald-700 |

KPI 5 ve 6 için tablo şu an yok — `count: 0` döndür, Faz 2 MVP A'da eklenecek.

## 5. Warm Welcome — 3 Mesaj (Brief'ten birebir)

**Mesaj 1 (greeting + core promise):**
```
👋 Merhaba {firstName}! ✨

Ben kişisel asistanınız UPU. 7/24 kasanızı her gün düzenli tutmak için çalışacağım.
```

`sleep 1800ms`

**Mesaj 2 (4 kabiliyet):**
```
🎯 *Yapabileceklerimden bazıları:*

✅ Sabah dünkü ciro + bugün stok brifinginizi getiririm
✅ Stok kritik seviyeye düşünce uyarır, tedarikçi sipariş önerisi sunarım
✅ Müşteri sadakat hatırlatmaları ve doğum günü kupon önerileri hazırlarım
✅ Tedarikçi siparişlerinizi WA'dan tek akışta sisteme alırım
```

`sleep 1800ms`

**Mesaj 3 (panel CTA + magic link):**
```
🖥 *Yönetim paneliniz hazır.*

Tüm sisteminizi yönetmek için panele gidin.

_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._
```
+ `sendUrlButton "🖥 Paneli Aç" → https://marketai.upudev.nl/tr/market-panelim?t=<TOKEN>` (`skipNav: true`)

profile.metadata onboarding_completed:true + discovery_step:"completed" set edilir. Mevcut market 4-adımlı onboarding-flow.ts atlanır (emlak pattern'i ile aynı).

## 6. Faz Dökümü

| # | Faz | Dosyalar | Süre |
|---|-----|----------|------|
| 1 | Plan dosyası | `.planning/MARKET-ADMIN-SHELL-2026-05.md` | 0.3 sa |
| 2 | API endpoints | `/api/market/init`, `/dashboard`, `/start`, `/web-sitem` | 1.5 sa |
| 3 | Route group + layout + sidebar config | `(market-panel)/layout.tsx` | 1.0 sa |
| 4 | Dashboard sayfası | `(market-panel)/market-panelim/page.tsx` | 1.0 sa |
| 5 | Stok liste sayfası | `(market-panel)/market-stok/page.tsx` + `/api/market/stok` | 1.0 sa |
| 6 | 7 placeholder sayfa | `(market-panel)/market-{tedarikciler,t.siparisleri,sadakat,kasa-raporu,hakkinda,oneri,destek}` | 0.7 sa |
| 7 | Profil form sayfası | `market-profilim/page.tsx` + `/api/market/profil/save` | 1.0 sa |
| 8 | Warm welcome | `tenants/market/intro.ts` + `platform/whatsapp/intro.ts` | 0.7 sa |
| 9 | Build + manuel test + commit | — | 0.8 sa |
| | **Toplam** | | **~8 saat** |

Brief scope (~6-9 saat) içinde.

## 7. Çakışma Stratejisi (Paralel Tmux Güvenliği)

- **(market-panel) route group:** İzole — emlak `(panel)` ile çakışmaz
- **/api/market/*:** İzole — emlak `/api/panel/*` ile çakışmaz
- **AdminLayout component:** Generic (sidebarItems prop alıyor); değiştirmeden kullanılır
- **intro.ts dokunuşu:** Minimum (5 satır) — INTRO_TENANTS set'i + 1 if branch + 1 import. Diğer tmux'lar aynı dosyaya farklı branch ekliyorsa merge conflict olabilir (kabul edilebilir küçük risk)

## 8. Risk + Çözüm

| Risk | Çözüm |
|------|-------|
| Market WA onboarding-flow.ts çağrılmıyor olur (4 adımlı flow) | Kasıtlı — emlak pattern'i. Kullanıcı /market-profilim form sayfasından detayları doldurur |
| `mkt_loyalty_customers` ve `mkt_promotions` tabloları yok | KPI sorgu maybeSingle/count fallback 0 döndürür; tablo Faz 2'de eklenir |
| Market profili kayıt webhook akışı `startIntro` çağrılmıyor olabilir | Webhook line 312/443'te `startIntro` zaten çağrılıyor; INTRO_TENANTS'a "market" eklemek tetikler |
| Build sırasında AdminLayout `sidebarItems` typing | TypeScript `SidebarItem[]` export edilmiş, sadece import |

## 9. Test PASS/FAIL Listesi

### Build + Statik
- [ ] `npm run build` PASS
- [ ] TS hata yok

### Yeni Akışlar
- [ ] `/tr/market-panelim?t=<TOKEN>` direkt URL → AdminLayout sarımı + KPI grid render
- [ ] Sidebar 10 item + separatorBefore + WhatsApp'a Dön footer
- [ ] Mobile drawer açılıp kapanıyor (375px)
- [ ] Tablet ikon-only (800px)
- [ ] Desktop full sidebar (1280px+)
- [ ] Hero "Panelim" + "Sisteminizi buradan yönetin" + italic alt satır
- [ ] Stok sayfası mkt_products listeliyor

### Korunan Akışlar (KIRILMADI)
- [ ] WA "stoksorgula" → mevcut komut çalışır
- [ ] WA "brifing" → mevcut komut çalışır
- [ ] WA "kasarapor" → mevcut komut çalışır
- [ ] Market 4-adımlı onboarding-flow.ts atlanmış olsa bile dosya integrity korunmuş

### Warm Welcome
- [ ] Yeni market kullanıcı kayıt → 3 mesaj sıralı + 1.8s sleep
- [ ] Mesaj 3 magic link Paneli Aç → market-panelim açılır
- [ ] profile.metadata.onboarding_completed:true set ediliyor

## 10. Commit Hash'ler (TBD)

| Faz | Commit | Açıklama |
|-----|--------|----------|
| 1 | _TBD_ | plan dosyası |
| 2 | _TBD_ | /api/market/* endpoints |
| 3 | _TBD_ | (market-panel) layout + sidebar |
| 4 | _TBD_ | market-panelim dashboard |
| 5 | _TBD_ | market-stok liste + /api/market/stok |
| 6 | _TBD_ | 7 placeholder sayfa |
| 7 | _TBD_ | market-profilim form + save endpoint |
| 8 | _TBD_ | warm welcome + intro hook |
| 9 | _TBD_ | build/test fix'leri (varsa) |

## 11. Revert Anchor

- Her faz commit'i ayrı; başarısızsa o faz'a revert kolay
- Tüm pivot başarısızsa: bu plan dosyası commit'inden öncesine `git reset --hard <pre-plan-hash>`

## 12. Sonraki Tur — MVP A "Sadık Müşterim" CRM

Bu shell tamamlandıktan sonra:
- `mkt_loyalty_customers` + `mkt_loyalty_visits` + `mkt_credit_ledger` + `mkt_broadcasts` tabloları
- 8 yeni komut: musteridavet, musterilerim, musteridetay, vadeacit, vadeodeme, sessizler, dogumgunu, broadcast
- Müşteri Sadakati placeholder sayfa → gerçek sadık üye listesi
- musteriIlişkileriSorumlusu agent (cron + reactive)
- Conversational dispatch (`satis ahmet 27` → AI parse)

Brief: ~18-22 saat AI ile, sonraki turda planlanır.
