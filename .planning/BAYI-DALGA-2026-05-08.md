# Bayi Toplu Güncelleme — PIVOT-PLAN Bölüm 11-19 Replikasyonu (2026-05-08)

Önceki tur: warm welcome + admin shell ön plan (commit `e2e67b5`).
Bu tur: emlak'ın 11-19. bölümlerinin bayi'ye uygulanması.

**Toplam scope: ~16-20 saat AI ile** — 3 dalgada böl.

Brifing: `/tmp/bayi-toplu-guncelleme.txt` (snapshot bu dosyada arşivli).

---

## Mevcut Durum (2026-05-08 sondajı)

### Bayi sayfaları (shell DIŞINDA, hepsi `/tr/<x>` doğrudan)
- `bayi-baglanti, bayi-calisan-davet, bayi-fatura, bayi-kampanya,
   bayiler, bayi-odeme, bayi-profil, bayi-siparis, bayi-urun-ekle,
   bayi-urun-import` (~10 sayfa)

### `(panel)` route group — emlak'a ait (çakışma riski!)
İçeride: `panel, mulklerim, musterilerim, sozlesmelerim, sozlesme-yap,
ara, takvim, hakkinda, oneri, destek`. Bayi için **`(bayipanel)` ayrı
group** veya tenant header'dan dispatch.

### AdminLayout — paylaşılan, hazır
`src/components/admin-layout.tsx` `sidebarItems: SidebarItem[]` prop'u
kabul eder. Default emlak; tenant kendi config geçer.

### Diğer tenant durumu
market/otel/restoran kendi panel group'unu oluşturmuş — paralel pattern.
Bayi'de YOK. Aynı pattern uygulanacak.

---

## Dalga 1 — UI Pivot (~6-7 saat) [ÖNCELIK]

Kapsam: Panelim + sidebar + kart aksiyon + form 2-buton + arama.

### Adım 1.1 — `(bayipanel)` route group oluştur
- `src/app/[locale]/(bayipanel)/layout.tsx`
- Token validate (`/api/bayi-panel/init`) + `<AdminLayout sidebarItems={BAYI_SIDEBAR}>`
- error/loading full-screen, ready → AdminLayout sarımı

### Adım 1.2 — Bayi sidebar config
`src/tenants/bayi/components/sidebar.ts` (restoran/otel pattern):
```ts
export const BAYI_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "panel",        label: "Panelim",        icon: "🏠", href: t => `/tr/panel?t=${t}`,         matchPath: "/tr/panel" },
  { id: "bayilerim",    label: "Bayilerim",      icon: "🏢", href: t => `/tr/bayilerim?t=${t}`,     matchPath: "/tr/bayilerim" },
  { id: "siparislerim", label: "Siparişlerim",   icon: "📋", href: t => `/tr/siparislerim?t=${t}`,  matchPath: "/tr/siparislerim" },
  { id: "tahsilatlarim",label: "Tahsilatlarım",  icon: "💰", href: t => `/tr/tahsilatlarim?t=${t}`, matchPath: "/tr/tahsilatlarim" },
  { id: "vade",         label: "Vade Hatırlatma",icon: "⏰", href: t => `/tr/vade-hatirlatma?t=${t}`, matchPath: "/tr/vade-hatirlatma" },
  { id: "kampanyalarim",label: "Kampanyalarım",  icon: "📣", href: t => `/tr/bayi-kampanya?t=${t}`, matchPath: "/tr/bayi-kampanya" },
  { id: "raporlar",     label: "Cirolarım",      icon: "📊", href: t => `/tr/raporlar?t=${t}`,      matchPath: "/tr/raporlar" },
  { id: "takvim",       label: "Takvim",         icon: "📅", href: t => `/tr/takvim?t=${t}`,        matchPath: "/tr/takvim" },
  { id: "profilim",     label: "Profilim",       icon: "👤", href: t => `/tr/profilim?t=${t}`,      matchPath: "/tr/profilim" },
  // 10. Web Sitem — bayi sahip kişisel sayfa şu an yok, atla
];
```
**Alt grup** (sidebar footer): UPUDev Hakkında / Öneri-Şikayet / Destek Talebi / WhatsApp'a Dön — paylaşılan emlak pattern'inde zaten var, AdminLayout default'tan miras alınır.

### Adım 1.3 — Panelim sayfası
- `src/app/[locale]/(bayipanel)/panel/page.tsx`
- Hero: "Sisteminizi buradan yönetin" + alt italik *"Paneldeki kartlara sol menüden de ulaşabilirsiniz."*
- 6 KPI grid (2-col mobile, 3-col desktop):
  1. Toplam Bayi (count)
  2. Aktif Sipariş (count, status pending/preparing/shipped)
  3. Bekleyen Fatura (count)
  4. Vadesi Geçmiş Tutar (sum overdue transactions)
  5. Bu Ay Ciro (sum orders.total_amount where created_at >= month_start)
  6. Kritik Stok (count where stock <= low_threshold)
- `/api/bayi-panel/dashboard` endpoint — Promise.all 6 paralel count

### Adım 1.4 — Mevcut sayfaları taşı
`git mv` ile `(bayipanel)/` altına:
- `bayiler` → `bayilerim` (rename + group)
- `bayi-siparis` → `siparislerim`
- `bayi-fatura` → `tahsilatlarim` veya yeni dashboard
- `bayi-kampanya` → tutucu (sidebar Kampanyalarım buradan açılır)

**Shell DIŞINDA bırak (form sayfaları)**:
- `bayi-profil`, `bayi-baglanti`, `bayi-urun-import`, `bayi-urun-ekle`,
  `bayi-calisan-davet`, `bayi-odeme` (form pattern)

### Adım 1.5 — Eksik sayfa iskeletleri
- `/tr/(bayipanel)/tahsilatlarim/page.tsx` (vade dashboard)
- `/tr/(bayipanel)/vade-hatirlatma/page.tsx` (Dalga 3 multi-row için
  iskelet, şimdilik placeholder)
- `/tr/(bayipanel)/raporlar/page.tsx` (placeholder)
- `/tr/(bayipanel)/takvim/page.tsx` (placeholder)
- `/tr/(bayipanel)/profilim/page.tsx` (özet + Profili Düzenle butonu)

### Adım 1.6 — Bölüm 12 kart aksiyon butonları
Her detay sayfasında üst primary aksiyon:
- bayilerim → "+ Bayi Ekle" (yeni form veya `bayi-davet`)
- siparislerim → "+ Sipariş Kaydet" (mevcut bayi-siparis form)
- tahsilatlarim → "+ Tahsilat Hatırlatma" (vade-hatirlatma'ya yönlendir)
- vade-hatirlatma → "+ Yeni Kural" (Dalga 3)
- bayi-kampanya → "+ Kampanya Oluştur"
- profilim → "Profili Düzenle"

### Adım 1.7 — Bölüm 13 form 2-buton + ipucu
Mevcut form sayfalarında alt: `[Kaydet] [Panele Dön]` 2 buton.
- `bayi-profil`, `bayi-baglanti`, `bayi-urun-ekle`, `bayi-calisan-davet`
- "Kaydet" → success state "✅ Kaydedildi"
- Form başında `<p className="text-xs text-slate-500">💡 İpucu: ...</p>`

### Adım 1.8 — Bölüm 15 liste arama kutusu
- `bayilerim` listesinde mevcut zaten (önceki tur). Tutarlı ✓
- `siparislerim` listesi — yeni: arama (bayi adı, ürün, sipariş no)
  - Live filter useState + debounce 350ms

**Commit**: `feat(bayi): admin shell — Panelim + sidebar + kart aksiyon + form 2-buton + arama`

---

## Dalga 2 — Evergreen + Bug Fix (~3 saat)

### Adım 2.1 — Bölüm 17 evergreen panel link
- `/api/bayi-panel/start` endpoint (emlak `/api/panel/start` kopyası):
  - phone-based fresh token mint (whatsapp_phone → profile lookup)
  - magic_link_tokens insert + redirect `/tr/panel?t=<TOKEN>`
- WA mesajlarındaki "Paneli Aç" / "Bayilerimi Aç" CTA'ları artık
  `/api/bayi-panel/start?phone=<encoded>` formatına yönlendir
- discovery-chain.ts ve handleBayiDurum'da CTA URL pattern güncelle
- Eski WA mesajlarından da çalışır → "Linkin süresi dolmuş" hatası bitsin

### Adım 2.2 — Bölüm 16 Web sayfa sade (varsa atla)
Bayi sahip kişisel web sayfası şu an yok → atla.

### Adım 2.3 — Mevcut bug'lar (varsa)
- Sidebar item WA komut tetikliyor olabilir (kontrol et) — düzelt panel
  sayfasına gitmeli (kritik bug fix Bölüm 11)

**Commit**: `feat(bayi): evergreen panel link + sidebar bug fix`

---

## Dalga 3 — AI + Multi-row Vade (~7-8 saat)

### Adım 3.1 — Bölüm 19 multi-row vade hatırlatma
**Schema migration** (`.planning/migrations/2026-05-08-bayi-tracking-rules.sql`):
```sql
CREATE TABLE bayi_tracking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  dealer_id UUID REFERENCES bayi_dealers(id),  -- NULL = tüm bayiler
  rule_type TEXT NOT NULL,                      -- vade_yaklasti, vade_gecti, ödeme_yapildi
  days_before INT,                              -- 7/3/0/-1 gün
  message_template TEXT NOT NULL,
  status TEXT DEFAULT 'active',                 -- active/paused/deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bayi_tracking_rules_user ON bayi_tracking_rules (user_id, status);
CREATE INDEX idx_bayi_tracking_rules_dealer ON bayi_tracking_rules (dealer_id);
```

**Endpoints**:
- `/api/bayi-vade-rule/list` — kullanıcının kuralları
- `/api/bayi-vade-rule/create`, `/update`, `/delete`, `/toggle`

**UI**: `/tr/(bayipanel)/vade-hatirlatma/page.tsx`
- Kart liste + status badge (active/paused)
- Her kartta `[Durdur] [Düzenle] [Sil]`
- Üst `[+ Yeni Kural]` modal — bayi seçici (boş = tüm bayiler) + tip + gün + template

**Cron** (yeni route veya morning-briefing'a eklenir):
- `/api/cron/bayi-vade-check` (her sabah 09:00 UTC)
- Aktif kuralları döner
- Match olan bayiler için kullanıcıya WA özet bildirim:
  *"3 bayide vade yaklaştı: Demir Ticaret 2 gün, Kalfa Boya 5 gün, Yılmaz Boya bugün"*

### Adım 3.2 — Bölüm 18 AI anlaşma
- `/tr/(bayipanel)/sozlesme-yap/page.tsx` veya `bayi-anlasma`
  - Form: bayi seç + ürün(ler) seç + vade gün + iskonto
  - "✨ AI Taslak Üret" buton → Claude Haiku
  - Disclaimer: *"Bu taslak otomatik üretilmiştir; hukuki bağlayıcılığı yoktur, danışmanınıza onaylatın."*
  - Paylaş + `bayi_anlasmalar` tablosuna kaydet
- `/tr/(bayipanel)/anlasmalarim/page.tsx` — liste + detay
- Schema: `bayi_anlasmalar` (id, user_id, tenant_id, dealer_id, content, status, created_at)

**Commit**: `feat(bayi): multi-row vade hatırlatma + AI anlaşma üretici`

---

## Test PASS/FAIL (her dalga sonu)

### Dalga 1
- [ ] Build PASS
- [ ] /tr/panel direkt URL → AdminLayout sarımı, bayi sidebar 9 item
- [ ] Sidebar item'ler PANEL sayfasına gidiyor (WA'a değil)
- [ ] usePathname active highlight
- [ ] Tablet ikon-only mode
- [ ] 4 viewport (375/800/1280/1920)
- [ ] 6 KPI doğru hesap
- [ ] Liste arama live filter

### Dalga 2
- [ ] /api/bayi-panel/start phone → fresh token → /tr/panel
- [ ] Eski WA mesajındaki link 2 saat sonra çalışıyor

### Dalga 3
- [ ] Migration uygulandı, RLS check
- [ ] 2 kural ekle, biri Durdur, biri Sil — UI tutarlı
- [ ] Cron eşleşince WA bildirim doğru gidiyor
- [ ] AI anlaşma metni Claude'dan dönüyor + kayıtlı

### Korunan (kırılmadı)
- [ ] WA komutları (bayilerim, siparis, tahsilat, urunler...)
- [ ] Form akışları (bayi-davet, sipariş kayıt, fatura yükleme)
- [ ] Magic link reuse (1 saat içinde)
- [ ] Logo/Yuki/Exact entegrasyon (varsa)

---

## Çakışma Notları

- **`(panel)` group emlak'a ait** — bayi için `(bayipanel)` ayrı group
  veya `(panel)` içine bayi-spesifik path'ler dispatch (tenant header'dan)
- **AdminLayout paylaşılan** — config'le miras al, override etme
- Diğer tenant'lar (otel/market/restoran) paralel kalan panel group'ları
  var; bayi onlardan etkilenmez
- `bayi-fatura` mı `tahsilatlarim`'a taşınsın yoksa ikisi ayrı sayfalar
  mı kararı kullanıcıya bırakıldı (Dalga 1.4'te)

---

## Sonraki Adım Önerisi

**Senaryo A — Tek dalga öncelik (önerilen)**:
- Dalga 1'i fresh context tek turda bitir (~6-7 saat). UI gözle test et.
- Dalga 2/3 ayrı turlarda.

**Senaryo B — Plan kabul + bekle**:
- Bu plan dosyasıyla yetin, gerçek implementation kullanıcı onayı
  + fresh /compact sonrası başlat.

**Senaryo C — Dalga 1'in küçük parçası (form 2-buton, 1 saat)**:
- En düşük risk, izole. Bayi formlarına `[Kaydet] [Panele Dön]` ekle.
- Diğer 6+ saat sonraki tura.

Kullanıcı hangisi olacağını seçer.
