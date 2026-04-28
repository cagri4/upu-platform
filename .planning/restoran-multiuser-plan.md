# Restoran Multi-User + Permission Tasarım Önerisi

> Faz 1 (kod yok) — sadece tasarım. Onaydan sonra implementasyona geçilir.
> Tarih: 2026-04-27 · Author: Claude (upu-platform agent)

---

## 1) Mevcut emlak'ta gördüklerim

**Kısa cevap:** emlak henüz capability-based modele geçmemiş — sadece role
("admin"/"dealer") seviyesinde minimal kontrol var (örn: `cmd:uzanti` sadece
admin'e gösteriliyor). Asıl olgun multi-user pattern **bayi**'de (post-pivot,
commit `becca7e: agents'ları tek UPU'ya birleştir + capabilities kolonu`).
Restoran için bayi'nin pattern'ini birebir uyarlayacağız.

### 1.1 Platform-genelinde kuruyoruz / hazır olan altyapı

Mevcut `profiles` tablosunda restoran'a yetecek tüm alanlar var:

| Alan | Tip | Anlamı |
|------|------|--------|
| `role` | `text` | `admin` \| `employee` \| `dealer` \| `system` \| `user` (admin = owner) |
| `capabilities` | `text[]` | `["*"]` = owner; alt-set = personel |
| `permissions` | `jsonb` | **eski model**, capabilities geldikten sonra ölü — restoran'da yazmıyoruz |
| `invited_by` | `uuid` | Davet eden owner'ın `profiles.id`'si — `/calisanyonet` listede filtre |
| `dealer_id` | `uuid` | Bayi'ye özel — restoran'da `null` (zincir/franchise gerekirse Phase 2) |
| `metadata` | `jsonb` | Tenant-spesifik bilgiler (restoran için: `position`, `shift_hours`, vb.) |

Davet altyapısı (3 yol — hepsi production):
- `invite_codes` — 6-hex, single-use (admin panelinin owner kayıt akışı + employee davet)
- `invite_links` — universal multi-use davet (`role` + `permissions` ön-belli, şehir yok limit)
- `bayi_invite_links` — bayi-only legacy (universal'dan önce yazılmış); restoran kullanmayacak
- `magic_link_tokens` — 2h web form linki (owner WA'da `/calisanekle` → web formu açılır)

### 1.2 Capability gate (router.ts'in iç işleyişi)

Her tenant `TenantCommandRegistry.requiredCapabilities` map'i tanımlar:

```ts
requiredCapabilities: {
  siparis: C.ORDERS_VIEW,             // tek capability
  odeme: [C.ORDERS_PAY, C.FINANCE],   // alternatifli (or)
  menu: null,                          // herkesin görebileceği
}
```

Router `hasCommandCapability(registry, ctx.capabilities, cmd)` ile filtreler:
- `*` wildcard → her şey ✅
- Boş `[]` → hiçbir şey ❌
- Match yoksa "Bu işlem için yetkin yok" mesajı

Aynı filtre **menüde** de uygulanır — `tenant.employees[].commands` listesinde
kullanıcının yapamayacağı komutlar gizlenir. `defaultFavorites`'lar da
filtreleniyor (router.ts:629).

### 1.3 Owner için "test as dealer/employee" view

`saas_active_session.view_as_role` ile owner kendi menüsünden çıkıp personelin
gördüğü menüye geçebiliyor (router'daki `/degistir` komutu). Restoran'da da
otomatik geliyor — `view_as_role` set edilince `effectiveRole` o role oluyor,
ama `actualRole` admin kalıyor (UI'da "Yönetici görünümüne dön" butonu).

### 1.4 Davet web formu (bayi-calisan-davet pattern'i)

`/tr/bayi-calisan-davet?t=<token>` formu:
1. Owner WA'da `/calisanekle` çağırır → `magic_link_tokens` 2h token üretir
2. Owner formu açar → ad + telefon + pozisyon + capability checkboxları
3. POST `/api/bayi-calisan-davet/save`:
   - `auth.users` create
   - `profiles` insert: `role: "employee"`, `capabilities: [...]`, `invited_by: ownerId`
   - `invite_codes` insert: 6-hex pending kod
   - WA mesajı çalışana: "Kayıt kodun: ABC123, bu mesaja yaz"
4. Çalışan kodu yazınca `profiles.whatsapp_phone` eşlenir, hesap aktif

`CAPABILITY_LABELS: Record<Cap, {label, group}>` ile form checkbox'ları
gruplanmış görünüyor (örn: "Sipariş", "Stok", "Finans" başlıkları altında).

---

## 2) Önerilen rol modeli — Restoran

5 rol. Hepsi **`profiles.role`** seviyesinde tek tenant içinde aynı altyapı,
ayrım `capabilities` array'iyle. Bayi gibi multi-organizasyon (dealer alt-tenant)
**yok** — restoran tek lokasyon, zincir/franchise gelecekte ayrı konu.

| Rol | DB role | Capabilities (preset) | Tipik kullanım |
|------|---------|----------------------|----------------|
| **Sahip** | `admin` | `["*"]` | Her şey, çalışan ekle, finans rapor, menü/fiyat değiştir |
| **Müdür** | `employee` | tüm view + write (employees:manage hariç) | Servisi yönet, rezervasyon ekle, menü düzenle, gün sonu görür |
| **Servis** | `employee` | TABLES, ORDERS_CREATE/VIEW, RESERVATIONS, MENU_VIEW | Masa açar, sipariş alır, masaya bakar, rezervasyon görür (eklemez) |
| **Mutfak** | `employee` | KITCHEN_QUEUE, KITCHEN_UPDATE, INVENTORY_VIEW, MENU_VIEW | Hazırlanan siparişler, "Hazır" işareti, stok kontrol |
| **Kasa** | `employee` | ORDERS_VIEW, ORDERS_PAY, REPORTS_VIEW (gün sonu) | Hesap kapatır, ödeme alır, gün sonu raporu |

Notlar:
- "Pozisyon" `profiles.metadata.position` alanında saklanır ("Manager", "Garson",
  "Aşçı", "Kasiyer") — UI etiketi için. `role` her zaman `employee`.
- Aynı kişi birden fazla rolü taşıyabilir (örn: küçük restoranda manager + cashier
  aynı vardiyada): owner davet ederken capability'leri kombineli seçer.
- Eski "view_as_role" mekanizması zaten admin'lere otomatik geliyor (test için).

---

## 3) Restoran Capability Registry

Yeni dosya: `src/tenants/restoran/capabilities.ts` (bayi'nin clone'u, prefix
farklı). Capability string'leri `domain:action` formatı (bayi konvansiyonu).

```
RESTORAN_CAPABILITIES:
  TABLES_VIEW            "tables:view"
  TABLES_MANAGE          "tables:manage"        // aç/kapa, durum değiştir

  ORDERS_VIEW            "orders:view"
  ORDERS_CREATE          "orders:create"        // sipariş aç + kalem ekle
  ORDERS_UPDATE          "orders:update"        // miktar/not değiştir, iptal
  ORDERS_PAY             "orders:pay"           // hesap kapat, ödeme tipi seç

  KITCHEN_QUEUE          "kitchen:queue"        // mutfak listesini gör
  KITCHEN_UPDATE         "kitchen:update"       // preparing → ready işaretle

  RESERVATIONS_VIEW      "reservations:view"
  RESERVATIONS_MANAGE    "reservations:manage"  // ekle/iptal/onayla

  MENU_VIEW              "menu:view"
  MENU_EDIT              "menu:edit"            // fiyat, kullanılabilirlik

  INVENTORY_VIEW         "inventory:view"
  INVENTORY_EDIT         "inventory:edit"       // stok güncelle, eşik
  INVENTORY_PURCHASE     "inventory:purchase"   // tedarikçiye sipariş

  REPORTS_VIEW           "reports:view"         // gün sonu, satış
  ANNOUNCEMENTS          "announcements:send"   // ekibe duyuru

  EMPLOYEES_MANAGE       "employees:manage"     // çalışan ekle/sil
```

**Preset'ler** (rol seçiminde owner formda dropdown'dan seçer, sonra ince ayar):

```
MANAGER_PRESET:
  TABLES_VIEW, TABLES_MANAGE,
  ORDERS_VIEW, ORDERS_CREATE, ORDERS_UPDATE, ORDERS_PAY,
  KITCHEN_QUEUE, KITCHEN_UPDATE,
  RESERVATIONS_VIEW, RESERVATIONS_MANAGE,
  MENU_VIEW, MENU_EDIT,
  INVENTORY_VIEW, INVENTORY_EDIT, INVENTORY_PURCHASE,
  REPORTS_VIEW, ANNOUNCEMENTS

WAITER_PRESET:
  TABLES_VIEW, TABLES_MANAGE,
  ORDERS_VIEW, ORDERS_CREATE, ORDERS_UPDATE,
  RESERVATIONS_VIEW,
  MENU_VIEW

KITCHEN_PRESET:
  KITCHEN_QUEUE, KITCHEN_UPDATE,
  INVENTORY_VIEW,
  MENU_VIEW

CASHIER_PRESET:
  TABLES_VIEW,
  ORDERS_VIEW, ORDERS_PAY,
  REPORTS_VIEW
```

**Caveat**: presetler kod tarafında hardcoded (bayi'deki `DEALER_PRESET` gibi).
Tenant-bazında özelleştirilebilir DB-driven preset gelecek konu.

---

## 4) Komut → capability matrisi

Mevcut Phase 1 read-only komutları + Phase 2'de eklenmesi gereken
write komutları için requiredCapabilities planı:

| Komut | Capability | Sahip | Müdür | Servis | Mutfak | Kasa |
|-------|------------|:-----:|:-----:|:------:|:------:|:----:|
| `siparis` (liste) | `ORDERS_VIEW` | ✅ | ✅ | ✅ | — | ✅ |
| `siparisac` (yeni) | `ORDERS_CREATE` | ✅ | ✅ | ✅ | — | — |
| `siparis-guncelle` | `ORDERS_UPDATE` | ✅ | ✅ | ✅ | — | — |
| `odeme` / `kasa` | `ORDERS_PAY` | ✅ | ✅ | — | — | ✅ |
| `masa` | `TABLES_VIEW` | ✅ | ✅ | ✅ | — | ✅ |
| `masa-ac` / `masa-kapa` | `TABLES_MANAGE` | ✅ | ✅ | ✅ | — | — |
| `mutfak` (queue) | `KITCHEN_QUEUE` | ✅ | ✅ | — | ✅ | — |
| `hazir` (status update) | `KITCHEN_UPDATE` | ✅ | ✅ | — | ✅ | — |
| `rezervasyon` | `RESERVATIONS_VIEW` | ✅ | ✅ | ✅ | — | — |
| `rezervasyon-ekle` | `RESERVATIONS_MANAGE` | ✅ | ✅ | — | — | — |
| `menukalemleri` | `MENU_VIEW` | ✅ | ✅ | ✅ | ✅ | — |
| `menu-duzenle` | `MENU_EDIT` | ✅ | ✅ | — | — | — |
| `stok` | `INVENTORY_VIEW` | ✅ | ✅ | — | ✅ | — |
| `stok-guncelle` | `INVENTORY_EDIT` | ✅ | ✅ | — | ✅ | — |
| `tedarikci-siparis` | `INVENTORY_PURCHASE` | ✅ | ✅ | — | — | — |
| `brifing` / `gunsonu` | `REPORTS_VIEW` | ✅ | ✅ | — | — | ✅ |
| `duyuru` | `ANNOUNCEMENTS` | ✅ | ✅ | — | — | — |
| `calisanekle` / `calisanyonet` | `EMPLOYEES_MANAGE` (= `*`) | ✅ | — | — | — | — |

**Mevcut Phase 1 komutlarına geri dönüş gerekiyor**: registry'ye
`requiredCapabilities` map'i ekleyeceğiz (kod değişikliği). Komutların kendisi
şu an "tüm tenant_id için listele" gibi geniş; kitchen rolünün gördüğü
"siparis" listesini queue'ya filtrelersek (örn: sadece `status in (new, preparing)`)
UX iyileşir — ama capability gate buna ek **filtreleme** yapmaz, sadece **erişim**
verir/vermez. Per-rol view filtering kod tarafında handler'da yapılır.

---

## 5) DB değişiklikleri

**Yeni tablo gerekmez.** Hepsi mevcut platform tablolarıyla yürür:
- `profiles` — `role`, `capabilities`, `invited_by`, `metadata` zaten var
- `invite_codes`, `magic_link_tokens` — zaten var
- `rst_*` tabloları (zaten yazıldı, henüz uygulanmadı) — RLS politikaları
  Supabase dashboard'da `tenant_id = jwt.tenant_id` filter'ıyla eklenir

**`rst_inventory` ve `rst_orders` için ek alan gerekebilir** (Phase 2 KDS için):
- `rst_orders.assigned_waiter_id UUID` (FK profiles) — kim aldı
- `rst_orders.cashier_id UUID` (FK profiles) — kim kapadı
- Bunlar **şimdi eklenmeyecek** — write komutları gelirken ayrı migration.

---

## 6) Onboarding akışı

### 6.1 Sahip onboarding (zaten yazıldı — `restoranOnboardingFlow`)
Owner ilk kayıttan sonra 6 adım: ad, restoran adı, bölge, mutfak türü,
kapasite, brifing tercihi. **Hiçbir değişiklik gerekmez.** Owner default
`capabilities: ["*"]` aldığı için tam erişimle başlar.

### 6.2 Personel davet web formu — yeni
Yol: `/tr/restoran-calisan-davet?t=<token>` — bayi-calisan-davet'ın clone'u.

Form alanları:
1. **Ad-soyad** (zorunlu)
2. **WhatsApp telefonu** (zorunlu, otomatik normalize)
3. **Rol** (dropdown — preset seçer):
   - Müdür / Servis / Mutfak / Kasa / *Özel*
4. **Yetkiler** (checkboxlar — preset'e göre default tikli, owner ekle/çıkar):
   - Gruplar: Masa, Sipariş, Mutfak, Rezervasyon, Menü, Stok, Rapor, Yönetim
   - "Tümünü seç (Müdür)", "Servis preseti", vb. quick buttons
5. **Pozisyon başlığı** (opsiyonel, freetext — örn "Akşam vardiyası şefi")
6. **Vardiya saatleri** (opsiyonel — Phase 2'de cron-bazlı brifing için)

POST `/api/restoran-calisan-davet/save`:
- Token doğrula (magic_link_tokens, 2h)
- `auth.users.create` placeholder email
- `profiles.insert`: `role: "employee"`, `capabilities: [...]`, `invited_by: ownerId`,
  `metadata: { position: "Garson", shift_hours: "16-24" }`
- `invite_codes.insert`: 6-hex pending kod
- `subscriptions.insert`: trial
- WA mesajı yeni çalışana: `"Kayıt kodun: ABC123 — kod ile bağlan"`

### 6.3 Personel ilk WA bağlanması
Davet kodu mesajı geldiğinde mevcut `invite_codes` flow zaten çalışır
(route.ts:466). Ek değişiklik: kod kullanıldığında `tenantKey === "restoran"`
ise mini-onboarding (1-2 soru) yerine **direkt menü** göster — personel zaten
owner tarafından tanımlandı, ek soruya gerek yok. (`onbFlow` bypass logic'i route.ts:514-520'da
genişletilecek, opsiyonel small change.)

Mesaj örneği:
```
👋 Hoş geldin Ahmet!
Yelken Cafe ekibine eklendin (Garson — Akşam vardiyası).

Komutların:
• masa — masa durumu
• siparis — açık siparişler
• rezervasyon — bugünkü rezervasyonlar
• menu — menü kart

[Ana Menü]
```

### 6.4 Davet kuralları (owner'ın görmesi gerekenler)
- **Aynı telefon**: aynı tenant_id altında zaten profile varsa "Bu kişi
  zaten ekipte" hatası
- **Hesabı silme**: `/calisanyonet` listesinden owner detaya girer → "Sil"
  (mevcut bayi pattern aynısı, sadece prefix değişiklik)
- **Yetki güncelleme**: ŞU AN YOK (bayi'de de yok). Phase 2 — sil + tekrar
  davet et workaround'u şimdilik.

---

## 7) WA UX — rol bazlı menü

`tenants/config.ts` içindeki `restoran.employees` array'i komut-grubu
"sanal çalışan" başlıklarıyla menüyü organize eder. `requiredCapabilities`
filtresi otomatik gizler — hiçbir özel kod gerekmez.

Yeni `employees` (revize):

```ts
employees: [
  { key: "asistan", name: "Asistan", icon: "📋",
    description: "Günlük brifing ve özet",
    commands: ["brifing", "gunsonu", "ozet"] },

  { key: "servis", name: "Servis", icon: "🍽",
    description: "Sipariş, masa ve rezervasyon",
    commands: ["siparis", "siparisac", "masa", "masaac",
               "rezervasyon", "rezervasyonekle"] },

  { key: "mutfak", name: "Mutfak", icon: "👨‍🍳",
    description: "Hazırlanan siparişler ve stok",
    commands: ["mutfak", "hazir", "stok", "stokguncelle", "menukalemleri"] },

  { key: "kasa", name: "Kasa", icon: "💰",
    description: "Hesap kapatma ve gün sonu",
    commands: ["odeme", "siparis", "gunsonu"] },

  { key: "yonetim", name: "Yönetim", icon: "⚙️",
    description: "Ekip, menü ve rapor (sadece sahip/müdür)",
    commands: ["calisanekle", "calisanyonet", "menuduzenle",
               "tedarikcisiparis", "duyuru"] },
],
```

**defaultFavorites** rol bazında değişmez — hepsi platform-default. Capability
filter zaten gizler. Eğer owner çalışanın favorilerini özel ayarlamak isterse
ileride ek feature.

### 7.1 Rol-bazında menü görünümü örnekleri

**Müdür** (manager preset) görür:
- Asistan, Servis, Mutfak, Kasa, Yönetim (calisanekle gizli — sahip-only)
- Tüm komutlar görünür

**Garson** (waiter preset) görür:
- Servis (sipariş+masa+rezervasyon view)
- Mutfak grubu görünmez (KITCHEN cap'leri yok)
- Asistan grubu görünmez (REPORTS cap'i yok)

**Aşçı** (kitchen preset) görür:
- Mutfak (mutfak/hazir/stok/menü görüntüleme)
- Sadece bu grup, başka hiçbir şey

**Kasiyer** (cashier preset) görür:
- Kasa grubu (odeme/siparis/gunsonu)
- Asistan'dan brifing değil sadece gun-sonu (REPORTS_VIEW)

### 7.2 Yeni komutlar (Phase 2 implementasyonunda gelecek)

Mevcut Phase 1 komutlarına ek olarak:
- `siparisac` — sipariş ekle (multi-step: masa → kalem → miktar → onay)
- `masaac` / `masakapa` — masa durumu değiştir
- `mutfak` — KITCHEN_QUEUE: hazırlanan siparişler liste
- `hazir` — sipariş kalemini "ready" işaretle
- `odeme` — masa hesabını kapat (cash/card)
- `rezervasyonekle` — yeni rezervasyon (web form magic link)
- `menuduzenle` — menü kalemi fiyat/availability (web form)
- `stokguncelle` — stok miktarı değiştir
- `tedarikcisiparis` — düşük stoklara sipariş
- `duyuru` — ekibe top-down mesaj
- `calisanekle` / `calisanyonet` — bayi'deki pattern aynısı

---

## 8) Açık sorular / tradeoff'lar

### 8.1 Pozisyon vs rol — hangisi DB seviyesinde tutulacak?
**Karar**: `profiles.role = "employee"` (sabit), `metadata.position` UI etiketi.
**Neden**: bayi'de olan pattern aynısı. Capability'ler asıl kontrol — pozisyon
sadece menüde "Garson Ahmet" gözükmesi için. Risk: owner aynı kişiyi hem
manager hem cashier yaparsa pozisyon "Manager" yazılır ama capability'lerde
ikisi var; kafa karıştırıcı olabilir. Çözüm: pozisyon string'i UI'da
"Müdür + Kasa" gibi kombineli yazdırılır.

### 8.2 KITCHEN ekrani: WA mı yoksa web KDS mi?
**Tavsiye**: KDS'in başlıca akışı **web** (tablet ekranı), WA'da `mutfak` komutu
eklenti gibi (cep telefonundan kontrol için). Çünkü:
- Mutfak ekranı sürekli açık olmalı, WA polling yapmaz
- Güncellenen siparişler KDS'te otomatik refresh olmalı (websocket veya polling)
- WA gateway'in eskidiği zaman mutfak körleşir
**Phase 2**: web KDS sayfası + `mutfak`/`hazir` komutları sadece "yedek/uzaktan
görüntüleme" için.

### 8.3 Multi-shift / vardiya: scope dışı mı?
**Tavsiye**: Şu an kapsam dışı. `metadata.shift_hours` field'ı eklensin (form'da
opsiyonel) ama enforce edilmesin. Phase 3'te:
- Vardiya başlangıç/bitiş bildirimi
- "X saat dışında komut çalıştırma" gate'i
- Cashier'ın gün sonu kapanışı vardiya bitince zorunlu

### 8.4 Multi-location / restoran zinciri
**Tavsiye**: Şu an scope dışı. Sahibi 2 şube açtığında kararı **2 ayrı tenant**
yapmak (basit) vs **1 tenant + branch_id** (kompleks). Bayi'nin dealer-tenant
ilişkisinden çıkarımla: branch konsepti `rst_branches` tablo + `profiles.branch_id`
+ tüm `rst_*` tablolarına `branch_id` FK gerektirir. Geç olmadan plana koymak
faydalı ama Phase 4-5.

### 8.5 AI Müşteri Asistanı (TR/NL/EN) — ürün vaadinde var
**Bu farklı bir kanal**: dış müşterinin restoran'a yazdığı bir bot (rezervasyon,
menü sor, çalışma saati). **Personel rol modeliyle alakasız** — public-facing
bir interface, ayrı plana ihtiyaç var. Phase 3+ olarak ayrı doküman
(restoran-ai-musteri-asistani.md) yapılması önerilir.

### 8.6 Owner çalışanı silince siparişlerini ne olur?
**Tavsiye**: Profile silinirken `rst_orders.assigned_waiter_id` ON DELETE SET NULL.
Loglar kaybolmaz, sadece "Garson: -" gösterilir. Bayi'de çalışan silinirken
böyle düşünülmemiş — emr işliyor mu bilmiyorum, restoran'da bilinçli SET NULL
olsun.

### 8.7 Sahip kendi capability'lerini değiştirebilir mi?
**Tavsiye**: HAYIR. Owner her zaman `["*"]`. Personel yetkilendirmesi sadece
`role: "employee"` olanlara. Sahip yanlışlıkla kendi yetkisini kaldırırsa
DB'den kurtulması gerekir. UI'da owner'a kendi capability'sini gösterme.

### 8.8 Aynı kişi 2 farklı SaaS'a admin (örn: emlakçı + cafe sahibi)
**Bu zaten çalışıyor** — `profiles` her tenant için ayrı satır, aynı
`whatsapp_phone`. `saas_active_session.active_saas_key` hangi SaaS'ta olduğunu
tutuyor. `/degistir` komutu SaaS arası geçişi sağlıyor. Restoran için ek iş yok.

---

## 9) Implementasyon yol haritası (onay sonrası)

**Faz A — Capability altyapısı (1-2 saat)**
- `src/tenants/restoran/capabilities.ts` (registry + presetler + labels)
- `src/tenants/restoran/commands/index.ts` → `requiredCapabilities` map ekle
- `tenants/config.ts` `restoran.employees` revize (5 grup yerine 4 + Yönetim)
- Test: owner WA'dan tüm komutları çalıştırabiliyor mu

**Faz B — Personel davet (3-4 saat)**
- `src/tenants/restoran/commands/calisan.ts` (`/calisanekle` + `/calisanyonet`
  + `/duyuru` — bayi clone)
- `src/app/[locale]/restoran-calisan-davet/page.tsx` (web form, capability
  checkbox grupları, preset dropdown)
- `src/app/api/restoran-calisan-davet/save/route.ts` (POST endpoint)
- Test: owner çalışan davet edip kod ile login → çalışan kısıtlı menü görüyor

**Faz C — Write komutları (Phase 2 — ayrı görev)**
- `siparisac`, `masaac`, `odeme`, `mutfak`, `hazir`, `rezervasyonekle`, vb.
- Bu doküman **bunu kapsamıyor** — ayrı plan.

---

## 10) Onay için sorular

1. **Rol sayısı 5 (sahip + 4 personel) yeterli mi?** Veya "Bar/İçecek
   sorumlusu", "Komi", "Maitre d'" gibi extra preset eklesek mi?
2. **Pozisyon başlığı serbest metin mi (manager karar verir) yoksa enum mu**
   ("Garson", "Aşçı", "Kasiyer" gibi)?
3. **Çalışan kendi vardiya/shift bilgisini WA'da mı görsün** (örn: profilim
   komutu) yoksa sadece owner'ın gördüğü liste mi?
4. **Multi-location ne zaman?** Phase 2-3'te konuşulsun mu yoksa şimdiden
   `branch_id` field'ı tüm tablolara ekleyelim (default null) — gelecekte
   migration ağrısı azalsın?
5. **AI Müşteri Asistanı** ayrı bir plana mı kalsın, yoksa restoran multi-user
   ile aynı milestone'a sıkıştırılsın mı?
6. **Faz A önce tek başına mergelensin mi** (capability gate aktif, davet
   sonra), yoksa Faz A+B bir bütün halinde mi push edilsin?

---

**Tahmini süre**: Faz A+B birlikte ~4-6 saat (review + test dahil).
**Onaydan sonra başlanacak.**
