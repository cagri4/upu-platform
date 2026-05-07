# Bayi Admin Shell + Warm Welcome — Replikasyon Planı (2026-05-07)

Emlak'ın yaptığı admin shell + warm welcome pattern'inin bayi tenant'ına
uygulanması. Referans: `.planning/EMLAK-ADMIN-SHELL-2026-05.md`.

---

## Tamamlanan (bu turda)

### Warm Welcome 3 mesaj split — `src/platform/whatsapp/intro.ts`
- ✅ `startBayiIntro` 2 blok → **3 blok** (selamlama + yetenekler + form)
- ✅ `sleep(1800)` arası gecikme (sohbet havası)
- ✅ firstName profile.metadata.firma_profili.yetkili_adi'dan çekiliyor
- ✅ Tüm metinler formal "siz"
- ✅ Core promise: *"7/24 tahsilatlarınızı ve sipariş operasyonunuzu kolaylaştıracağım"*
- ✅ 4 madde brifingdeki spec'le birebir
- ⚠️ Mesaj 3 hâlâ form çağrısı (profil yok henüz — admin shell kurulduktan sonra "Paneli Aç" CTA'ya çevrilebilir)

---

## Kalan (sonraki tur — fresh context gerekli)

### Faz A — `(panel)` route group + AdminLayout reuse

**Adım 1.** `src/components/admin-layout.tsx` zaten paylaşılan, prop'larla generic.
Bayi sidebar config'i:
```tsx
const BAYI_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "panel",        label: "Dashboard",   icon: "🏠", href: t => `/tr/panel?t=${t}`,         matchPath: "/tr/panel" },
  { id: "bayiler",      label: "Bayilerim",   icon: "🏪", href: t => `/tr/bayiler?t=${t}`,       matchPath: "/tr/bayiler" },
  { id: "siparisler",   label: "Siparişler",  icon: "🛒", href: t => `/tr/bayi-siparisler?t=${t}`, matchPath: "/tr/bayi-siparisler" },
  { id: "faturalar",    label: "Faturalar",   icon: "📄", href: t => `/tr/bayi-faturalar?t=${t}`, matchPath: "/tr/bayi-faturalar" },
  { id: "tahsilat",     label: "Tahsilat",    icon: "💰", href: t => `/tr/bayi-tahsilat?t=${t}`,  matchPath: "/tr/bayi-tahsilat" },
  { id: "kampanyalar",  label: "Kampanyalar", icon: "🎁", href: t => `/tr/bayi-kampanyalar?t=${t}`, matchPath: "/tr/bayi-kampanyalar" },
  { id: "urunler",      label: "Ürünler",     icon: "📦", href: t => `/tr/urunler?t=${t}`,       matchPath: "/tr/urunler" },
  { id: "profil",       label: "Profilim",    icon: "⚙️", href: t => `/tr/bayi-profil?t=${t}`,    matchPath: "/tr/bayi-profil" },
];
```

**Adım 2.** `src/app/[locale]/(panel)/layout.tsx` — emlak ile aynı pattern (token validate + AdminLayout sarımı).

> ⚠️ Çakışma kontrolü: emlak zaten `(panel)` group kullanıyor. Bayi için **`(bayipanel)` veya tenant-aware tek `(panel)`** (tenant header'dan dispatch). Emlak/bayi paralel için en temizi: `(bayipanel)` ayrı group. AdminLayout `sidebarItems` config'i farklı.

### Faz B — Dashboard + 6 KPI

**Adım 3.** `/api/bayi/dashboard` endpoint:
- bayi_count = SELECT count FROM bayi_dealers WHERE tenant_id=X AND is_active=true
- active_orders = SELECT count FROM bayi_orders WHERE tenant_id=X AND status_id IN (pending/preparing/shipped)
- pending_invoices = SELECT count FROM bayi_dealer_invoices WHERE tenant_id=X
- overdue_amount = SUM(amount) FROM bayi_dealer_transactions WHERE type=sale AND due_date<NOW() (yaklaşık — gerçek hesap = sale - payment dengesi geçmiş)
- monthly_revenue = SUM(total_amount) FROM bayi_orders WHERE created_at>=this_month_start
- low_stock_alerts = SELECT count FROM bayi_products WHERE stock_quantity <= low_stock_threshold

**Adım 4.** `(bayipanel)/panel/page.tsx` — KPI grid (2-col mobile, 3-col desktop), hero gradient, bayi-tonlu (mavi: indigo→sky? veya emlak emerald'i miras al?).

### Faz C — Mevcut sayfaları taşı

**Adım 5.** `git mv` ile `(bayipanel)/` altına:
- `src/app/[locale]/bayiler/` → `src/app/[locale]/(bayipanel)/bayiler/`
- `src/app/[locale]/urunler/` → `src/app/[locale]/(bayipanel)/urunler/`
- (yeni: bayi-siparisler, bayi-faturalar, bayi-tahsilat, bayi-kampanyalar liste sayfaları yoksa oluştur — Faz D)

**Shell DIŞINDA bırak (form sayfaları)**:
- `bayi-profil` (form, full-screen WA WebView)
- `bayi-siparis` (form — sahip değil, dealer için)
- `bayi-fatura` (form — yükleme)
- `bayi-kampanya` (form)
- `bayi-baglanti`, `bayi-urun-import`, `bayi-urun-ekle`, `bayi-calisan-davet`, `bayi-odeme`

### Faz D — Eksik liste sayfaları

Sidebar'da olan ama mevcut olmayan sayfalar:
- `/tr/bayi-siparisler` — sipariş listesi (paginated, filter status)
- `/tr/bayi-faturalar` — fatura listesi (vade rozet)
- `/tr/bayi-tahsilat` — tahsilat dashboard'u (vadesi geçen + bekleyen + ödenen)
- `/tr/bayi-kampanyalar` — aktif kampanya listesi

### Faz E — WA selamlama "Paneli Aç" CTA

Profil tamamlandıktan sonra (intro Mesaj 3'ün karşılığı):
- `discovery-chain.ts` Step 1 mesajı (firma_kaydedildi sonrası) — şu an demo seed mesajı.
- Adım 9 (tour completed) sonrası "🖥 Paneli Aç" CTA URL → `/tr/panel?t=...`
- Veya: tour skip yapan kullanıcılar için `cmd:webpanel` handler `/tr/panel?t=...`'a yönlendirsin.

---

## Test PASS/FAIL Listesi (sonraki tur)

### Build + Statik
- [ ] `npm run build` PASS
- [ ] Route group `(bayipanel)` URL'e yansımıyor
- [ ] TS hata yok

### Korunan Akışlar (KIRILMADI)
- [ ] WA `/bayilerim` → list mesajı
- [ ] WA `/siparis` → CTA URL
- [ ] WA `/tahsilat` → CTA URL
- [ ] Magic link reuse — 5x sıralı

### Yeni Akışlar
- [ ] /tr/panel direkt URL → AdminLayout sarımı
- [ ] Sidebar usePathname auto-active highlight
- [ ] Tablet ikon-only mode (md=64px → lg=256px)
- [ ] 4 viewport testi (375/800/1280/1920)
- [ ] ESC drawer kapat
- [ ] Tab nav focus ring

### Warm Welcome
- [x] 3 mesaj 1.8 sn arayla
- [x] firstName selamlama
- [x] formal "siz"
- [ ] gerçek WA testi (yeni profil oluştur, mesajları sırayla al)

---

## Scope (sonraki tur)

- AdminLayout config + (bayipanel) layout: 1-1.5 saat
- Dashboard endpoint + page: 1-1.5 saat
- Sayfa taşıma + import path düzeltmeleri: 30-45 dk
- Eksik liste sayfaları (siparişler/faturalar/tahsilat/kampanyalar): 2-3 saat
- WA selamlama "Paneli Aç" CTA: 30 dk
- Self-test 4 viewport + WA: 1-1.5 saat

**Toplam: 6-9 saat AI ile.**

---

## Renk Paleti Önerisi

Emlak: emerald (yeşil — gayrimenkul, doğa)
Bayi: **indigo veya sky** (B2B kurumsal mavi tonu)

KPI gradients:
- bayi_count: indigo→sky
- active_orders: emerald→teal
- pending_invoices: amber→orange
- overdue_amount: rose→pink (kritik)
- monthly_revenue: violet→fuchsia
- low_stock_alerts: slate→stone

Sidebar active item: `bg-indigo-600` (emerald yerine).
