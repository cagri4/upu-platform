# Otel Multi-User + Permission Tasarım Önerisi

> Faz 1 (kod yok) — sadece tasarım. Onaydan sonra implementasyona geçilir.
> Tarih: 2026-04-27 · Author: Claude (upu-platform agent)
> Referans: `bayi-multiuser-plan.md`, `restoran-multiuser-plan.md`,
> `src/tenants/bayi/capabilities.ts`, `src/tenants/bayi/commands/index.ts:197+`

---

## 1) Mevcut emlak / platform altyapısında gördüklerim

**Kısa cevap:** Capability-based multi-user pattern'i **bayi**'de production'a
girmiş, **restoran** için plan yazılmış (henüz uygulanmamış olabilir). Otel için
aynı pattern'i birebir uyarlayacağız — yeni altyapı yazmaya gerek yok.

### 1.1 Platform-genelinde hazır altyapı (otel için yeniden yazılmayacak)

`profiles` tablosunda otel'e yetecek tüm alanlar var:

| Alan | Tip | Anlamı |
|------|------|--------|
| `role` | `text` | `admin` \| `employee` \| `dealer` \| `system` \| `user` (admin = owner) |
| `capabilities` | `text[]` | `["*"]` = owner; alt-set = personel |
| `permissions` | `jsonb` | **eski model**, capabilities geldikten sonra ölü — otel'de yazmıyoruz |
| `invited_by` | `uuid` | Davet eden owner'ın `profiles.id`'si — `/calisanyonet` listede filtre |
| `dealer_id` | `uuid` | Bayi'ye özel; otel'de `null` (otel'in branch konsepti `otel_user_hotels` üzerinden) |
| `metadata` | `jsonb` | Tenant-spesifik (otel: `position`, `shift_hours`, `assigned_floors`) |

**Otel'e özel mevcut tablo:** `otel_user_hotels` zaten DB'de — owner'ın 1+ otele
sahip olabilmesi için `profile_id × hotel_id` join tablosu. Bu, multi-property
zinciri için temel — bayi'de `dealer_id` ne işe yarıyorsa otel'de `hotel_id`
aynı işi görüyor.

Davet altyapısı (3 yol — hepsi production):
- `invite_codes` — 6-hex single-use (admin paneli + employee davet)
- `invite_links` — universal multi-use (`role` + `capabilities` ön-belli)
- `magic_link_tokens` — 2h web form linki (owner WA'da `/calisanekle` → web form)

### 1.2 Capability gate (router.ts'in iç işleyişi)

Doğrulanmış: `src/platform/whatsapp/router.ts:34-50` — `hasCommandCapability(registry, ctx.capabilities, cmd)`.

Her tenant `TenantCommandRegistry.requiredCapabilities` map'i tanımlar (bayi referans):

```ts
requiredCapabilities: {
  rezervasyonlar: C.RESERVATIONS_VIEW,           // tek capability
  odeme: [C.FINANCE_PAYMENTS, C.FINANCE_OWN],    // alternatifli (or)
  brifing: null,                                  // herkese açık
}
```

`*` wildcard owner'a otomatik tüm yetki. Aynı filtre **menüde**
(`tenant.employees[].commands`) ve `defaultFavorites`'larda da uygulanır
(router.ts:629, 844). Yetkisiz komut → "Bu işlem için yetkin yok" mesajı.

### 1.3 "Test as employee" view

`saas_active_session.view_as_role` ile owner çalışan menüsünü simüle edebiliyor
(`/degistir` komutu, router.ts:111). Otel'de otomatik gelir.

### 1.4 Davet web formu pattern'i

`src/app/[locale]/bayi-calisan-davet/page.tsx` + `/api/bayi-calisan-davet/{init,save}`
referans. Otel klonlayacak:
1. Owner WA'da `/calisanekle` → 2h `magic_link_tokens` üretilir → buton
2. Form: ad + telefon + pozisyon + capability checkbox grupları + (opsiyonel) hotel_id
3. POST: `auth.users.create` + `profiles.insert (role=employee, capabilities=...)`
   + `invite_codes` 6-hex pending → çalışana WA mesajı: "Kayıt kodun: ABC123"
4. Çalışan kodu yazınca `profiles.whatsapp_phone` eşlenir, hesap aktif

### 1.5 Mevcut otel tenant durumu

- Config: `src/tenants/config.ts:109-128` — slug `hotelai`, 4 employee group (resepsiyon/rezervasyon/katHizmetleri/misafirDeneyimi). **Yönetim ve Muhasebe grubu yok** → revize edilecek.
- Commands: `src/tenants/otel/commands/index.ts` — 20 komut, `requiredCapabilities` map'i **henüz yok**.
- DB: `otel_reservations`, `otel_rooms`, `otel_hotels`, `otel_housekeeping_tasks`, `otel_guest_messages`, `otel_guest_requests`, `otel_guest_reviews`, `otel_user_hotels` — 8 tablo (production-yakını).

---

## 2) Önerilen rol modeli — Otel

7 rol. Hepsi `profiles.role` seviyesinde, ayrım `capabilities` array'iyle.

| Rol | DB role | Capabilities (preset) | Tipik kullanım |
|------|---------|----------------------|----------------|
| **Sahip** | `admin` | `["*"]` | Her şey, çalışan ekle, finans, fiyat değiştir |
| **Müdür** | `employee` | tüm view + write (EMPLOYEES_MANAGE hariç) | Operasyonel günlük yönetim, brifing alır |
| **Resepsiyon** | `employee` | RESERVATIONS_*, GUESTS_*, ROOMS_VIEW, AVAILABILITY_VIEW, PRICING_VIEW, HOUSEKEEPING_VIEW | Check-in/out, rezervasyon ekle, misafir mesajı |
| **Temizlik Şefi** | `employee` | HOUSEKEEPING_*, ROOMS_VIEW, ROOMS_STATUS_EDIT, GUESTS_VIEW | Görev atama, oda durumu (kirli/temiz) |
| **Kat Görevlisi** | `employee` | HOUSEKEEPING_VIEW_OWN, HOUSEKEEPING_COMPLETE_OWN, ROOMS_VIEW | Sadece kendine atanan görevleri görür/kapatır |
| **F&B Şefi** | `employee` | FNB_*, GUESTS_VIEW, ROOMS_VIEW | Mutfak/restoran/oda servisi (Phase 2 — komut yok henüz) |
| **Muhasebeci** | `employee` | FINANCE_*, REPORTS_VIEW, RESERVATIONS_VIEW | Gelir, fatura, vergi, gün sonu raporları |

**Notlar:**
- "Pozisyon" `profiles.metadata.position` alanında ("Resepsiyonist", "Kat Görevlisi", "Mutfak Şefi") — UI etiketi için.
- Aynı kişi birden fazla preset alabilir (örn: küçük butik otelde Müdür + Muhasebeci aynı kişi): davet formunda capability'ler birleştirilerek seçilir.
- Multi-property: `otel_user_hotels` üzerinden. Owner birden fazla otelde "*" olabilir; çalışan tek otele bağlı.

---

## 3) Otel Capability Registry

Yeni dosya: `src/tenants/otel/capabilities.ts` (bayi'nin clone'u, prefix farklı).

```
OTEL_CAPABILITIES:
  # Rezervasyon
  RESERVATIONS_VIEW         "reservations:view"
  RESERVATIONS_CREATE       "reservations:create"     // yeni rez ekle
  RESERVATIONS_EDIT         "reservations:edit"       // değiştir/iptal
  RESERVATIONS_CHECKIN      "reservations:checkin"    // check-in/out işlemi

  # Oda
  ROOMS_VIEW                "rooms:view"              // oda listesi/durum
  ROOMS_STATUS_EDIT         "rooms:status-edit"       // boş/dolu/temiz/kirli toggle
  ROOMS_CONFIG_EDIT         "rooms:config-edit"       // oda tipi/kapasite/özellik (admin'e yakın)

  # Kat hizmetleri (housekeeping)
  HOUSEKEEPING_VIEW         "housekeeping:view"       // tüm görevleri gör
  HOUSEKEEPING_VIEW_OWN     "housekeeping:view-own"   // sadece kendine atanan
  HOUSEKEEPING_ASSIGN       "housekeeping:assign"     // görev ata
  HOUSEKEEPING_COMPLETE     "housekeeping:complete"   // görev kapat (her görev)
  HOUSEKEEPING_COMPLETE_OWN "housekeeping:complete-own" // sadece kendi görevini kapat

  # Misafir
  GUESTS_VIEW               "guests:view"             // misafir listesi/profil
  GUESTS_MESSAGE            "guests:message"          // mesaj/yanıt yaz
  GUESTS_REVIEWS            "guests:reviews"          // yorum yönetimi (yanıtla)

  # Fiyat / müsaitlik / revenue management
  AVAILABILITY_VIEW         "availability:view"
  PRICING_VIEW              "pricing:view"            // sezon fiyat sorgu
  PRICING_EDIT              "pricing:edit"            // fiyat güncelle (RM)

  # Finans
  FINANCE_VIEW              "finance:view"            // gelir, fatura görüntüle
  FINANCE_EDIT              "finance:edit"            // gelir kaydı, fatura kesme
  REPORTS_VIEW              "reports:view"            // gün sonu, doluluk raporu

  # F&B (Phase 2 — komutlar henüz yok, ilerideki write-komutlar için)
  FNB_VIEW                  "fnb:view"                // mutfak menü / sipariş listesi
  FNB_EDIT                  "fnb:edit"                // sipariş hazırlama, oda servisi

  # Yönetim
  ANNOUNCEMENTS             "announcements:send"      // ekibe duyuru
  EMPLOYEES_MANAGE          "employees:manage"        // çalışan ekle/sil — owner-only
```

### Presetler

```
MANAGER_PRESET (Müdür):
  RESERVATIONS_VIEW, RESERVATIONS_CREATE, RESERVATIONS_EDIT, RESERVATIONS_CHECKIN,
  ROOMS_VIEW, ROOMS_STATUS_EDIT, ROOMS_CONFIG_EDIT,
  HOUSEKEEPING_VIEW, HOUSEKEEPING_ASSIGN, HOUSEKEEPING_COMPLETE,
  GUESTS_VIEW, GUESTS_MESSAGE, GUESTS_REVIEWS,
  AVAILABILITY_VIEW, PRICING_VIEW, PRICING_EDIT,
  FINANCE_VIEW, REPORTS_VIEW,
  ANNOUNCEMENTS

RECEPTION_PRESET (Resepsiyon):
  RESERVATIONS_VIEW, RESERVATIONS_CREATE, RESERVATIONS_EDIT, RESERVATIONS_CHECKIN,
  GUESTS_VIEW, GUESTS_MESSAGE,
  ROOMS_VIEW, AVAILABILITY_VIEW, PRICING_VIEW,
  HOUSEKEEPING_VIEW   // oda hazır mı görmek için

HOUSEKEEPING_CHIEF_PRESET (Temizlik Şefi):
  HOUSEKEEPING_VIEW, HOUSEKEEPING_ASSIGN, HOUSEKEEPING_COMPLETE,
  ROOMS_VIEW, ROOMS_STATUS_EDIT,
  GUESTS_VIEW   // misafir check-out etti mi kontrolü

HOUSEKEEPER_PRESET (Kat Görevlisi):
  HOUSEKEEPING_VIEW_OWN, HOUSEKEEPING_COMPLETE_OWN,
  ROOMS_VIEW    // kendi katındaki odaları görmek (read-only)

FNB_CHIEF_PRESET (F&B Şefi — Phase 2 komut bekleniyor):
  FNB_VIEW, FNB_EDIT,
  GUESTS_VIEW, ROOMS_VIEW,    // oda servisi için
  REPORTS_VIEW  // F&B gelir raporu

ACCOUNTANT_PRESET (Muhasebeci):
  FINANCE_VIEW, FINANCE_EDIT,
  REPORTS_VIEW,
  RESERVATIONS_VIEW   // rezervasyon ↔ fatura ilişkisi
```

**Caveat:** Presetler kod tarafında hardcoded (bayi'deki `DEALER_PRESET` gibi).
Owner formda preset dropdown'dan seçer, sonra checkbox'larda ince ayar yapar.

---

## 4) Komut → capability matrisi

Mevcut 20 komut için `requiredCapabilities` planı + Phase 2'de eklenmesi gereken
write komutlar:

| Komut | Capability | Sahip | Müdür | Resep. | T.Şefi | Kat Gör. | F&B | Muh. |
|-------|------------|:-----:|:-----:|:------:|:------:|:--------:|:---:|:----:|
| `durum` | `null` (genel) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `brifing` | `REPORTS_VIEW` | ✅ | ✅ | — | — | — | — | ✅ |
| `rapor` | `REPORTS_VIEW` | ✅ | ✅ | — | — | — | — | ✅ |
| `gelir` | `FINANCE_VIEW` | ✅ | ✅ | — | — | — | — | ✅ |
| `rezervasyonlar` | `RESERVATIONS_VIEW` | ✅ | ✅ | ✅ | — | — | — | ✅ |
| `rezervasyonekle` | `RESERVATIONS_CREATE` | ✅ | ✅ | ✅ | — | — | — | — |
| `rezervasyondetay` | `RESERVATIONS_VIEW` | ✅ | ✅ | ✅ | — | — | — | ✅ |
| `checkin` | `RESERVATIONS_CHECKIN` | ✅ | ✅ | ✅ | — | — | — | — |
| `checkout` | `RESERVATIONS_CHECKIN` | ✅ | ✅ | ✅ | — | — | — | — |
| `musaitlik` | `AVAILABILITY_VIEW` | ✅ | ✅ | ✅ | — | — | — | — |
| `fiyat` | `PRICING_VIEW` | ✅ | ✅ | ✅ | — | — | — | — |
| `misafirler` | `GUESTS_VIEW` | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| `mesajlar` | `GUESTS_MESSAGE` | ✅ | ✅ | ✅ | — | — | — | — |
| `yanitla` | `GUESTS_MESSAGE` | ✅ | ✅ | ✅ | — | — | — | — |
| `yorumlar` | `GUESTS_REVIEWS` | ✅ | ✅ | ✅ | — | — | — | — |
| `odalar` | `ROOMS_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `odaguncelle` | `ROOMS_STATUS_EDIT` (durum) / `ROOMS_CONFIG_EDIT` (config) | ✅ | ✅ | — | ✅* | — | — | — |
| `temizlik` | `[HOUSEKEEPING_VIEW, HOUSEKEEPING_VIEW_OWN]` | ✅ | ✅ | — | ✅ | ✅** | — | — |
| `gorevata` | `HOUSEKEEPING_ASSIGN` | ✅ | ✅ | — | ✅ | — | — | — |
| `doluluk` | `REPORTS_VIEW` | ✅ | ✅ | — | — | — | — | ✅ |

\* Temizlik şefi sadece status (kirli/temiz/dnd) toggle eder, oda config (tip, kapasite) admin/müdüre kalır.
\** Kat görevlisi `temizlik` listesini görüyor ama handler-level filter ile **sadece kendine atanan** satırları gösteriyor (bayi'deki `*_OWN` pattern aynı).

### Phase 2 (yeni write komutları — bu plan kapsamı dışı)

| Komut | Capability | Sahip | Müdür | Resep. | T.Şefi | Kat Gör. | F&B | Muh. |
|-------|------------|:-----:|:-----:|:------:|:------:|:--------:|:---:|:----:|
| `gorevkapat` (housekeeper) | `[HOUSEKEEPING_COMPLETE, HOUSEKEEPING_COMPLETE_OWN]` | ✅ | ✅ | — | ✅ | ✅ | — | — |
| `fiyatguncelle` (RM) | `PRICING_EDIT` | ✅ | ✅ | — | — | — | — | — |
| `faturakes` | `FINANCE_EDIT` | ✅ | ✅ | — | — | — | — | ✅ |
| `gelirkaydi` | `FINANCE_EDIT` | ✅ | ✅ | — | — | — | — | ✅ |
| `oda-servisi` (F&B) | `FNB_EDIT` | ✅ | ✅ | — | — | — | ✅ | — |
| `mutfak-siparis` (F&B) | `FNB_VIEW` | ✅ | ✅ | — | — | — | ✅ | — |
| `duyuru` | `ANNOUNCEMENTS` | ✅ | ✅ | — | — | — | — | — |
| `calisanekle` / `calisanyonet` | `EMPLOYEES_MANAGE` (= `*`) | ✅ | — | — | — | — | — | — |

**Per-rol view filtering:** Capability gate sadece komuta erişim verir/vermez.
Kat görevlisinin "kendi görevleri" filtresi handler içinde
`firstMatchingCapability(...)` çağrısıyla ayrılır (bayi'deki `ORDERS_VIEW_OWN`
pattern aynı: capabilities listesinde `_OWN` versiyonu varsa `assigned_to = ctx.userId` filter'ı atılır).

---

## 5) DB değişiklikleri

**Yeni tablo gerekmez.** Hepsi mevcut platform + otel tablolarıyla yürür.

### 5.1 Mevcut tablolarda küçük migration'lar (önerilen)

| Tablo | Alan | Tip | Neden |
|-------|------|------|-------|
| `otel_housekeeping_tasks` | `assigned_to` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | Kat görevlisinin "own" filter'ı için. (Muhtemelen zaten var — verify.) |
| `otel_reservations` | `created_by` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | Hangi resepsiyonist yarattı izlensin (audit) |
| `otel_reservations` | `checked_in_by` / `checked_out_by` | `uuid REFERENCES profiles(id)` | Vardiya bazlı denetim için |
| `otel_guest_messages` | `replied_by` | `uuid REFERENCES profiles(id)` | Hangi resepsiyonist yanıtladı |

**Not:** Bunlar **şimdi eklenmeyecek** — write komutları gelirken ayrı migration. Sadece `otel_housekeeping_tasks.assigned_to` Phase 1'de gerekli (own filter).

### 5.2 RLS

Mevcut `tenant_id = jwt.tenant_id` filter'ı yetiyor. Multi-hotel için ek RLS:
```sql
-- Eğer profiles.role != 'admin', otel_user_hotels'de kayıtlı hotel_id'lerle sınırla
USING (hotel_id IN (
  SELECT hotel_id FROM otel_user_hotels WHERE profile_id = auth.uid()
))
```
Bu Faz 2 — şu an tek otelli senaryoda gerekmez.

### 5.3 `otel_user_hotels` rolü

Çalışan davet edilirken `otel_user_hotels` insert ile hangi otelde çalıştığı
işaretlenir. Owner'ın 1+ otel olabilir; default davette owner'ın aktif oteline
eklenir, multi-hotel chain'de form'da dropdown.

---

## 6) Onboarding akışı

### 6.1 Sahip onboarding (zaten yazıldı)

`otelOnboardingFlow` mevcut: 4 adım — hotel_name, location, room_count, briefing.
**Hiçbir değişiklik gerekmez.** Owner default `capabilities: ["*"]` aldığı için tam erişimle başlar.

**Tek küçük ekleme:** onboarding bitince `otel_user_hotels` ve `otel_hotels`
tablolarına ilk otel kaydı atılsın (multi-hotel hazır olsun). Şu an manuel
büyük olasılıkla — verify.

### 6.2 Personel davet web formu — yeni

Yol: `/tr/otel-calisan-davet?t=<token>` — bayi-calisan-davet'ın clone'u.

**Form alanları:**
1. **Ad-soyad** (zorunlu)
2. **WhatsApp telefonu** (zorunlu, otomatik normalize)
3. **Rol** (dropdown — preset seçer):
   - Müdür / Resepsiyon / Temizlik Şefi / Kat Görevlisi / F&B Şefi / Muhasebeci / *Özel*
4. **Yetkiler** (checkboxlar — preset'e göre default tikli, owner ekle/çıkar):
   - Gruplar: Rezervasyon, Misafir, Oda, Temizlik, Fiyat, Finans, Yönetim
5. **Pozisyon başlığı** (opsiyonel, freetext — örn "Gece Resepsiyonisti")
6. **Vardiya saatleri** (opsiyonel — "08:00–16:00" / "Gece"; Phase 2'de cron-bazlı brifing)
7. **Atanmış katlar** (Kat Görevlisi için, opsiyonel — "1, 2, 3" gibi; UI'da dropdown çoklu seç)
8. **Otel** (multi-hotel'li owner için zorunlu dropdown; tek otelli auto)

**POST `/api/otel-calisan-davet/save`:**
- Token doğrula (`magic_link_tokens`, 2h)
- `auth.users.create` placeholder email
- `profiles.insert`: `role: "employee"`, `capabilities: [...]`, `invited_by: ownerId`,
  `metadata: { position, shift_hours, assigned_floors }`, `tenant_id: otel`
- `otel_user_hotels.insert`: `profile_id × hotel_id` link
- `invite_codes.insert`: 6-hex pending kod
- `subscriptions.insert`: trial (varsa)
- WA mesajı yeni çalışana: `"Kayıt kodun: ABC123 — kod ile bağlan"`

### 6.3 Personel ilk WA bağlanması

Davet kodu mesajı geldiğinde mevcut `invite_codes` flow zaten çalışır
(`route.ts:466`). Çalışan için **mini-onboarding bypass**: tenantKey `otel`
ise direkt rol-spesifik welcome:

```
👋 Hoş geldin Ayşe!
Marina Resort ekibine eklendin
(Resepsiyonist — Gündüz vardiyası).

Komutların:
• rezervasyonlar — bugünkü rezervasyonlar
• checkin — misafir karşıla
• checkout — misafir uğurla
• mesajlar — okunmamış mesajlar
• misafirler — misafir listesi

[Ana Menü]
```

### 6.4 Davet kuralları (owner görmesi gerekenler)

- **Aynı telefon**: aynı `tenant_id` altında zaten profile varsa "Bu kişi zaten ekipte" hatası
- **Hesabı silme**: `/calisanyonet` → çalışan detay → "Sil" (bayi pattern aynı, prefix değişir)
- **Yetki güncelleme**: ŞU AN YOK (bayi'de de yok). Phase 2 — sil + tekrar davet workaround
- **Vardiya bazlı login engeli**: ŞU AN YOK — feature flag'li gelecek (Açık soru 8.2)

---

## 7) WA UX — rol bazlı menü

`tenants/config.ts` içindeki `otel.employees` array'i mevcut **4 grupla yetersiz**
— `Yönetim` ve `Muhasebe` eksik. Revize:

```ts
employees: [
  { key: "asistan", name: "Asistan", icon: "📋",
    description: "Brifing, rapor ve günlük özet",
    commands: ["brifing", "durum", "rapor", "doluluk"] },

  { key: "resepsiyon", name: "Resepsiyon", icon: "🛎️",
    description: "Rezervasyon, check-in/out, misafir mesajları",
    commands: ["rezervasyonlar", "rezervasyonekle", "rezervasyondetay",
               "checkin", "checkout", "musaitlik", "fiyat",
               "misafirler", "mesajlar", "yanitla"] },

  { key: "katHizmetleri", name: "Kat Hizmetleri", icon: "🧹",
    description: "Oda durumu, temizlik ve görev atama",
    commands: ["odalar", "odaguncelle", "temizlik", "gorevata"] },

  { key: "misafirDeneyimi", name: "Misafir Deneyimi", icon: "⭐",
    description: "Yorumlar, geri bildirim",
    commands: ["yorumlar"] },

  { key: "muhasebe", name: "Muhasebe", icon: "💰",
    description: "Gelir, fatura, finansal raporlar",
    commands: ["gelir", "rapor", "doluluk"] },

  { key: "yonetim", name: "Yönetim", icon: "⚙️",
    description: "Ekip ve duyuru (sadece sahip/müdür)",
    commands: ["calisanekle", "calisanyonet", "duyuru"] },
],
```

`requiredCapabilities` filtresi otomatik gizler — hiçbir özel kod gerekmez
(router.ts:844 zaten yapıyor). `defaultFavorites: ["brifing", "durum", "rezervasyonlar"]`
kalabilir; capability filtresi yetkisizlere göstermez.

### 7.1 Rol-bazında menü görünümü (örnekler)

**Müdür** (manager preset) görür:
- Asistan, Resepsiyon, Kat Hizmetleri, Misafir Deneyimi, Muhasebe, Yönetim (calisanekle gizli)

**Resepsiyonist** (reception preset):
- Resepsiyon (tüm), Kat Hizmetleri (sadece `odalar` ve `temizlik`-VIEW görünür çünkü diğerleri ASSIGN/EDIT cap'i ister), Asistan ve Muhasebe gizli

**Temizlik Şefi**:
- Kat Hizmetleri (tüm), Misafir Deneyimi gizli, Asistan'dan sadece `durum`

**Kat Görevlisi**:
- Sadece "Kat Hizmetleri" altında `odalar` (read) ve `temizlik` (own filter)
- Çok dar menü — neredeyse tek-amaçlı; UX OK

**Muhasebeci**:
- Asistan (rapor), Muhasebe (tüm), Resepsiyon'dan sadece `rezervasyonlar` ve `rezervasyondetay` (read)

**F&B Şefi** (Phase 2 — komutlar gelmeden boş görünür, şimdi davet edilemesin)

---

## 8) Açık sorular / tradeoff'lar

### 8.1 Multi-hotel: şimdi mi sonra mı?

**Mevcut durum:** `otel_user_hotels` ve `otel_hotels` tabloları zaten var. Owner zaten teorik olarak çoklu otel sahibi olabiliyor.

**Tavsiye:** Faz 1'de capability gate **tek otelli** akışta çalışsın (owner'ın
ilk oteli default scope). Davet formuna `hotel_id` dropdown koyalım ama tek
otel varsa otomatik seçilsin. Faz 2'de RLS ile `otel_*` tablolarına `hotel_id`
filter ekleyelim. Geç olmadan plana dahil etmek migration ağrısını azaltır.

### 8.2 Vardiya enforcement — capability mi metadata mı?

**Tavsiye:** Şu an metadata-only (`profiles.metadata.shift_hours`). Capability
seviyesinde "vardiya dışı kullanılamaz" gate'i değil. UI'da "Vardiya: 16:00–24:00"
gösterilir, davet edilirken planlanır. Phase 3'te:
- `cron` tetikli vardiya başlangıç bildirimi
- "X saat dışında write komut" gate'i (capability'leri runtime'da kısıtla)

### 8.3 Kat Görevlisi "own" filtresi: capability mi, query mi?

**Tavsiye (bayi pattern):** İki capability gerekli: `HOUSEKEEPING_VIEW` (full)
ve `HOUSEKEEPING_VIEW_OWN` (kısıtlı). Handler `firstMatchingCapability(...)` ile
ilk eşleşeni alır:
- `_VIEW` varsa: tüm tasks
- `_VIEW_OWN` varsa: `WHERE assigned_to = ctx.userId`
- İkisi de yoksa: capability gate zaten yetkisiz mesajı verir

Bu, sahip görmek istediğinde tüm görevleri, kat görevlisinin sadece kendininkini
görmesini tek handler'da kotarır. **Şart:** `otel_housekeeping_tasks.assigned_to`
FK profiles olmalı (verify et, eksikse migration).

### 8.4 Misafir self-service (online check-in via SMS) — scope dışı mı?

**Bu farklı bir kanal:** Misafir kendisi otelle WhatsApp üzerinden iletişime
geçer (rezervasyon onaylama, online check-in formu, oda servis sipariş).
Personel rol modeliyle alakasız — public-facing interface, ayrı plan.
**Phase 3+ olarak ayrı doküman** (`otel-misafir-self-service.md`).

### 8.5 F&B (Mutfak/Restoran şefi) — şimdi mi?

**Mevcut durum:** Otel'de F&B tablosu/komut yok. Restoran SaaS'ı ayrı tenant.

**Tavsiye:** F&B preset'ini şimdilik form'a koyma — boş menü gösterir, kafa
karıştırır. Phase 2'de:
- `otel_fnb_orders`, `otel_fnb_menu` tablolar
- `oda-servisi`, `mutfak-siparis`, `mutfak-hazir` komutları
- F&B preset enable

Alternatif: küçük oteller restoran tenant'ını ayrı abone olur (multi-SaaS aynı
WA hesabında zaten çalışıyor — `/degistir` ile geçiş).

### 8.6 Misafir mesajları multi-channel?

`otel_guest_messages` şu an WA ile mi sınırlı, Booking/Airbnb mesajlarıyla
da entegre mi? Eğer ileride entegrasyon olursa `GUESTS_MESSAGE` tek capability
yetiyor — kanal bazlı bölmeye gerek yok şimdilik.

### 8.7 Owner kendi capability'lerini değiştirebilir mi?

**Tavsiye:** HAYIR. Owner her zaman `["*"]`. UI'da kendi capability'sini
göstermeyelim (yanlışlıkla kaldırırsa DB'den kurtulması gerekir).

### 8.8 Aynı telefon, birden fazla otel sahibi (zincir)

`profiles` her tenant için ayrı satır, aynı `whatsapp_phone`. Otel
zincirinde owner her bir otel için ayrı `profiles` kaydı (tenant aynı, hotel_id
farklı). `otel_user_hotels` ile ilişkilenir.

**Açık soru:** Aynı tenant'ta aynı kişiyi 2 otele bağlayalım mı, yoksa her otel
ayrı tenant mı? **Tavsiye:** Tek tenant + multi `otel_user_hotels` — RLS hotel_id
filter'ı yapar, tek WA bot, tek menü.

### 8.9 Çalışan silinince ilişkili kayıtlar

**Tavsiye:**
- `otel_housekeeping_tasks.assigned_to` → `ON DELETE SET NULL`
- `otel_reservations.created_by/checked_in_by/checked_out_by` → `ON DELETE SET NULL`
- `otel_guest_messages.replied_by` → `ON DELETE SET NULL`
Loglar kaybolmaz, "Personel: -" gösterilir.

### 8.10 Resepsiyonist gece vardiyası raporu

**Tradeoff:** `REPORTS_VIEW` resepsiyona verilse mi? Gece vardiyası
ertesi gün owner için "gece kaç check-in oldu" raporu görmek isteyebilir.

**Tavsiye:** Default vermesin — Müdüre ve Muhasebeciye yeter. Eğer ihtiyaç
çıkarsa owner formda manuel ekler (capability checkbox'larından `REPORTS_VIEW`
tikler).

---

## 9) İmplementasyon yol haritası (onay sonrası)

**Faz A — Capability altyapısı (1-2 saat)**
- `src/tenants/otel/capabilities.ts` (registry + presetler + labels)
- `src/tenants/otel/commands/index.ts` → `requiredCapabilities` map ekle (tüm 20 komut)
- `src/tenants/config.ts` `otel.employees` revize (mevcut 4 grup + Muhasebe + Yönetim)
- Test: owner WA'dan tüm komutları çalıştırabiliyor mu (mevcut akışta regression yok mu)

**Faz B — Personel davet (3-4 saat)**
- `src/tenants/otel/commands/calisan.ts` (`/calisanekle` + `/calisanyonet` + `/duyuru` — bayi clone)
- `src/app/[locale]/otel-calisan-davet/page.tsx` (web form, capability checkbox grupları, preset dropdown, hotel_id dropdown)
- `src/app/api/otel-calisan-davet/save/route.ts` (POST endpoint)
- `otel_user_hotels` insert mantığı save endpoint'inde
- Test: owner çalışan davet → kod ile login → çalışan kısıtlı menü görüyor

**Faz C — `_OWN` filter & migration (1 saat)**
- `otel_housekeeping_tasks.assigned_to` FK kontrol/migration (eksikse ekle)
- `temizlik` ve (Phase 2) `gorevkapat` handler'larında `firstMatchingCapability(...)` ile own/full filter
- Test: kat görevlisi sadece kendi görevlerini görüyor

**Faz D — Multi-hotel RLS (Phase 2 — ayrı görev)**
- `otel_*` tablolarına `hotel_id` filter'lı RLS politikaları
- Owner'ın multi-hotel test akışı

**Faz E — Write komutları + F&B (Phase 2 — ayrı görev)**
- Bu doküman **bunu kapsamıyor** — ayrı plan.

---

## 10) Onay için sorular

1. **Rol sayısı 7 (sahip + 6 personel) yeterli mi?** "Güvenlik şefi", "SPA yöneticisi", "Animasyon" gibi extra preset eklesek mi?
2. **F&B Şefi preset'i şimdi form'a koyalım mı** (boş menü görür) yoksa Phase 2'ye mi erteleyelim?
3. **Multi-hotel** Phase 1'de mi (RLS dahil) yoksa Phase 2'ye mi (basitlik için tek-otel scope)?
4. **Vardiya saatleri** form alanı opsiyonel mi yoksa zorunlu mu? Phase 3'te enforcement gelecekse şimdiden zorunlu yapalım mı?
5. **Çalışanın gördüğü welcome mesajı** rol-spesifik mi (yukarıdaki örnek gibi) yoksa generic mi?
6. **`otel_user_hotels` kayıt mantığı** — owner onboarding'de otomatik ilk otel oluşturuluyor mu? Eğer hayırsa Faz A'ya bu da girsin.
7. **Faz A önce tek başına mergelensin mi** (capability gate aktif, davet sonra), yoksa Faz A+B+C bütün halinde mi push edilsin?
8. **Misafir self-service** ayrı milestone'a mı, yoksa otel multi-user ile aynı milestone'a mı sıkıştırılsın?

---

**Tahmini süre**: Faz A+B+C birlikte ~5-7 saat (review + test dahil).
**Onaydan sonra başlanacak.**
