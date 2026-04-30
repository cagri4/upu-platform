# Otel Multi-User + Misafir CRM — MVP1 Plan

> **Revize: 2026-05-01.** Orijinal plan (2026-04-27) personel-only ve single-hotel
> idi. Reframe sonrası MVP1 büyüdü: lifetime guest CRM + mekik web panel + multi-tenant
> ölçek + online check-in MVP1'e dahil. Eski plan git history'de.
>
> Author: Claude (upu-platform agent) · Referans: `bayi-multiuser-plan.md`,
> `bayi-tek-asistan-vision-2026-04-30.md`, `src/tenants/bayi/capabilities.ts`,
> `src/tenants/bayi/commands/calisan.ts`, `src/app/api/bayi-calisan-davet/save/route.ts`

---

## 0) Kararlar (kullanıcı onayı alınmış)

| # | Karar | Not |
|---|-------|-----|
| K1 | Misafir = role `guest`, **lifetime** | Capability silinmez, tarihçe kalır → loyalty CRM motorunun temel veri katmanı |
| K2 | Misafir tarafı **WA-driven** + mekik web panel | Browse'da arama yok, sadece WA'dan tıklanan tokenized link açılır, kalıcı hesap yok |
| K3 | **Binlerce otel** ölçeği | `hotel_id` propagasyonu zorunlu, RLS Phase-1'de |
| K4 | Online check-in **MVP1**'de | Cron T-24h auto-trigger + `cekin` komutu + resepsiyon push, mekik formuyla |
| K5 | F&B + brand + loyalty engine **MVP2** | F&B preset davet formuna girmiyor, brand isimlendirme MVP1'de yer-tutucu |

---

## 1) MVP1 vs MVP2 scope sınırı

### MVP1 (bu plan kapsamı)
- ✅ **Faz A — Capability altyapısı** (registry + presets + requiredCapabilities map)
- ✅ **Faz B — Multi-property RLS** (`hotel_employees` tablosu + hotel_id-aware policies)
- ✅ **Faz C — Personel davet** (`/calisanekle` + web form clone'u + role presetler)
- ✅ **Faz D — Misafir** (role=guest lifetime + GUEST_PRESET + WA komutlar + `/misafirdavet`)
- ✅ **Faz E — Online check-in** (mekik form + `otel_pre_checkins` + cron T-24h)

### MVP2 (ayrı milestone — bu plan kapsamı dışı)
- ❌ Brand katmanı (`otel_brands` + brand-scoped persona/wa_phone)
- ❌ Loyalty engine (cron + AI segment + owner approval queue + opt-in)
- ❌ Ek hizmet rezervasyon mekik linkleri (spa/transfer/restoran)
- ❌ F&B Şefi preset + komutlar (`oda-servisi`, `mutfak-siparis`)
- ❌ Misafir yorumu (`/yorum` mekik link)
- ❌ Vardiya bazlı capability gate
- ❌ Channel manager (Booking.com / Airbnb / Expedia)

---

## 2) Roller (8 rol — 7 personel + 1 misafir)

| Rol | DB role | Capability (preset) | Lifecycle |
|-----|---------|---------------------|-----------|
| **Sahip** | `admin` | `["*"]` | Kalıcı |
| **Müdür** | `employee` | tüm view + write (EMPLOYEES_MANAGE hariç) | Kalıcı |
| **Resepsiyon** | `employee` | RESERVATIONS_*, GUESTS_*, ROOMS_VIEW, AVAILABILITY_VIEW, PRICING_VIEW, HOUSEKEEPING_VIEW, GUESTS_INVITE, PRE_CHECKIN_VIEW | Kalıcı |
| **Temizlik Şefi** | `employee` | HOUSEKEEPING_*, ROOMS_VIEW, ROOMS_STATUS_EDIT, GUESTS_VIEW | Kalıcı |
| **Kat Görevlisi** | `employee` | HOUSEKEEPING_VIEW_OWN, HOUSEKEEPING_COMPLETE_OWN, ROOMS_VIEW | Kalıcı |
| **Muhasebeci** | `employee` | FINANCE_*, REPORTS_VIEW, RESERVATIONS_VIEW | Kalıcı |
| **F&B Şefi** | `employee` | FNB_*, GUESTS_VIEW, ROOMS_VIEW | **MVP2** |
| **🆕 Misafir** | `guest` | GUEST_PRESET (sadece read + tek-yön talep) | **Lifetime** — silinmez |

**Notlar:**
- Misafir DB'de `role='guest'` ile, **`profiles.capabilities` = GUEST_PRESET**, `metadata.invited_for_hotel_id` set.
- Misafir capability'leri **sıfırlanmaz**. Checkout sonrası bile aynı yetkilerle (kendi rezervasyon geçmişi + hizmet sorgu) WA'da kalır → loyalty CRM motoru bu sayede çalışır.
- Owner asla `guest` rolüne dönmez; misafirlerin de `*` yok.

---

## 3) Capability Registry (`src/tenants/otel/capabilities.ts`)

```
OTEL_CAPABILITIES (personel):
  # Rezervasyon
  RESERVATIONS_VIEW         "reservations:view"
  RESERVATIONS_CREATE       "reservations:create"
  RESERVATIONS_EDIT         "reservations:edit"
  RESERVATIONS_CHECKIN      "reservations:checkin"

  # Oda
  ROOMS_VIEW                "rooms:view"
  ROOMS_STATUS_EDIT         "rooms:status-edit"
  ROOMS_CONFIG_EDIT         "rooms:config-edit"

  # Kat hizmetleri
  HOUSEKEEPING_VIEW         "housekeeping:view"
  HOUSEKEEPING_VIEW_OWN     "housekeeping:view-own"
  HOUSEKEEPING_ASSIGN       "housekeeping:assign"
  HOUSEKEEPING_COMPLETE     "housekeeping:complete"
  HOUSEKEEPING_COMPLETE_OWN "housekeeping:complete-own"

  # Misafir (personel-tarafı)
  GUESTS_VIEW               "guests:view"
  GUESTS_MESSAGE            "guests:message"
  GUESTS_REVIEWS            "guests:reviews"
  GUESTS_INVITE             "guests:invite"          # /misafirdavet komutu (resepsiyon)

  # Müsaitlik / fiyat
  AVAILABILITY_VIEW         "availability:view"
  PRICING_VIEW              "pricing:view"
  PRICING_EDIT              "pricing:edit"

  # Finans / rapor
  FINANCE_VIEW              "finance:view"
  REPORTS_VIEW              "reports:view"

  # Online check-in
  PRE_CHECKIN_VIEW          "pre-checkin:view"       # online check-in tamamlanmış misafiri görüntüle
  PRE_CHECKIN_PUSH          "pre-checkin:push"       # /cekinlink komutu — manuel push

  # MVP2 (rezerve kalıyor, davet formunda gizli)
  FNB_VIEW                  "fnb:view"
  FNB_EDIT                  "fnb:edit"

  # Yönetim
  ANNOUNCEMENTS             "announcements:send"
  EMPLOYEES_MANAGE          "employees:manage"

GUEST_CAPABILITIES (misafir-tarafı, lifetime):
  RESERVATIONS_VIEW_OWN     "reservations:view-own"
  GUEST_SERVICES_VIEW       "guest-services:view"     # otel hizmet listesi (wifi, kahvaltı, spa-var-mı)
  GUEST_REQUEST_CREATE      "guest-request:create"    # talep / şikayet
  GUEST_PRE_CHECKIN_FORM    "guest-pre-checkin:form"  # mekik check-in linkini açabilir
  GUEST_RESERVATION_CANCEL  "reservations:cancel-own" # iptal politikasına göre
```

### Presetler

```
MANAGER_PRESET:           tüm OTEL_CAPABILITIES (EMPLOYEES_MANAGE hariç) + PRE_CHECKIN_VIEW
RECEPTION_PRESET:         RESERVATIONS_*, GUESTS_*, ROOMS_VIEW, AVAILABILITY_VIEW,
                          PRICING_VIEW, HOUSEKEEPING_VIEW, GUESTS_INVITE,
                          PRE_CHECKIN_VIEW, PRE_CHECKIN_PUSH
HOUSEKEEPING_CHIEF_PRESET: HOUSEKEEPING_*, ROOMS_VIEW, ROOMS_STATUS_EDIT, GUESTS_VIEW
HOUSEKEEPER_PRESET:       HOUSEKEEPING_VIEW_OWN, HOUSEKEEPING_COMPLETE_OWN, ROOMS_VIEW
ACCOUNTANT_PRESET:        FINANCE_VIEW, REPORTS_VIEW, RESERVATIONS_VIEW
GUEST_PRESET:             RESERVATIONS_VIEW_OWN, GUEST_SERVICES_VIEW, GUEST_REQUEST_CREATE,
                          GUEST_PRE_CHECKIN_FORM, GUEST_RESERVATION_CANCEL
```

---

## 4) Multi-Tenant Ölçek — `hotel_employees` + RLS

### 4.1 Mimari karar

`profiles.capabilities` **flat array**, hotel_id taşımıyor. Multi-property ölçeğinde:
**bir resepsiyonist sadece atandığı oteldeki rezervasyonu görmeli.** Bu yüzden:

- `profiles.capabilities` = **default/global capability bundle** (tek otelliler için yeterli)
- **Yeni: `hotel_employees(hotel_id, profile_id, capabilities, created_at)`** — per-hotel override
- Resolver: `getEffectiveCapabilities(profile_id, hotel_id)` → `hotel_employees` varsa onu kullan, yoksa `profiles.capabilities` fallback

### 4.2 RLS politika örneği

```sql
-- otel_reservations için
CREATE POLICY "hotel_scoped_read" ON otel_reservations
  FOR SELECT
  USING (
    -- Owner ('*'): tüm hotelleri otel_user_hotels üzerinden görür
    hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE profile_id = auth.uid())
    OR
    -- Employee: hotel_employees'de bağlı olduğu otel
    hotel_id IN (SELECT hotel_id FROM hotel_employees WHERE profile_id = auth.uid())
    OR
    -- Misafir: kendi rezervasyonu (hotel_id = bu rez'in hotel_id'si zaten — guest_id eşleşmesi)
    guest_profile_id = auth.uid()
  );
```

**Not:** `auth.uid()` Supabase JWT'sinden gelir. WhatsApp router context'inde service-role kullandığımız için RLS bypass edilir, ama web panel ve API'ler RLS-aware olmalı.

### 4.3 Misafir hotel_id binding

- `profiles.metadata.invited_for_hotel_id` — davet edildiği otel
- `otel_guest_hotels(profile_id, hotel_id, first_visit, last_visit, total_stays)` rollup — loyalty segment için (MVP2 başlığı altında, MVP1'de boş tablo+trigger okuyacak şekilde hazırlanır)

---

## 5) Mekik UX Pattern (`bayi-calisan-davet` referans)

Misafir için web panel **kalıcı hesap istemez** — emlak'ın "ara sunum" pattern'i:

```
WA → "Online check-in için tıkla → [link]"
       ↓
   Tokenized URL (magic_link_tokens, 72h, multi-use)
       ↓
   Form/sayfa açılır → işini yapar → kapatır
```

### 5.1 Token ailesi

`magic_link_tokens` mevcut tablo (bayi'de var). MVP1'de `purpose` alanı genişletilir:

| `purpose` | Süre | Use | Kim için |
|-----------|------|-----|----------|
| `bayi-calisan-davet` | 2h | single-use | personel davet |
| `otel-calisan-davet` | 2h | single-use | personel davet (yeni) |
| `otel-pre-checkin` | 72h | **multi-use** | misafir online check-in (geri dönüp düzeltebilir) |
| `otel-iptal` | 24h | single-use | misafir rez iptal onayı (MVP2) |

**Gerekiyorsa migration:** `magic_link_tokens.purpose TEXT` ve `magic_link_tokens.metadata JSONB` alanları doğrula/ekle.

### 5.2 Misafir mekik sayfaları (MVP1)

| Yol | Amaç | Token |
|-----|------|-------|
| `/tr/otel-cekin?t=<token>` | Online check-in formu | otel-pre-checkin |

MVP2'de eklenecek: `/tr/otel-iptal`, `/tr/otel-yorum`, `/tr/otel-spa`, `/tr/otel-fatura/<id>`.

---

## 6) Online Check-in Akışı (MVP1 Faz E)

### 6.1 Tetikleyiciler

| Tetik | Kim | Ne zaman |
|-------|-----|----------|
| **Cron** (default) | Sistem | Rez `check_in_date - 24h` → otomatik WA mesajı |
| **Misafir manuel** | Misafir | `cekin` komutu → 72h link |
| **Resepsiyon push** | Yetkili | `/cekinlink <rezId>` (cap: PRE_CHECKIN_PUSH) |

### 6.2 Form içeriği (`otel-cekin` mekik sayfası)

- Otel header (logo + ad — MVP1: tenant-default)
- Misafir ad/soyad (rez'den ön-doldurulur, düzeltilebilir)
- Kimlik foto upload (TC kimlik / passport) → Supabase Storage `pre-checkins/{hotel_id}/{rez_id}/`
- E-imza (signature pad — KVKK aydınlatma + konaklama sözleşmesi)
- Kişisel tercih: yastık tipi, kahvaltı diyet (vegan/glütensiz), allerji, sigara, varış saati ETA
- KVKK + Pazarlama opt-in (ayrı tik) — MVP2 loyalty için kritik

### 6.3 Submit sonrası (atomik)

```
otel_pre_checkins(rez_id, hotel_id, kimlik_foto_url, signature_url,
                  preferences, kvkk_accepted_at, marketing_opt_in, completed_at) INSERT
otel_reservations.pre_checkin_complete = true UPDATE
profiles.metadata.marketing_opt_in = true (eğer tik)
WA → misafir: "Online check-in tamamlandı, otele gelince anahtar kartınız hazır olacak"
WA → resepsiyon (PRE_CHECKIN_VIEW yetkili): "Misafir X online check-in yaptı, kimlik+imza hazır"
magic_link_tokens.used_at IS NULL kalır (multi-use, geri dönüş mümkün) — ama 72h sonra expires_at fail eder
```

### 6.4 Fiziksel check-in

Misafir otele gelince **resepsiyon yetkilisi `RESERVATIONS_CHECKIN`** ile sistem üzerinden onaylar → status='checked_in'. Bu adım **manuel kalır** (yasal sebep: kimlik fizibıl doğrulama otelin yükümlülüğü).

---

## 7) Komut → Capability Matrisi

### 7.1 Personel komutları (mevcut 20)

| Komut | Capability | Sahip | Müdür | Resep. | T.Şefi | Kat Gör. | Muh. |
|-------|------------|:-----:|:-----:|:------:|:------:|:--------:|:----:|
| durum | null | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| brifing | REPORTS_VIEW | ✅ | ✅ | — | — | — | ✅ |
| rapor | REPORTS_VIEW | ✅ | ✅ | — | — | — | ✅ |
| gelir | FINANCE_VIEW | ✅ | ✅ | — | — | — | ✅ |
| rezervasyonlar | RESERVATIONS_VIEW | ✅ | ✅ | ✅ | — | — | ✅ |
| rezervasyonekle | RESERVATIONS_CREATE | ✅ | ✅ | ✅ | — | — | — |
| rezervasyondetay | RESERVATIONS_VIEW | ✅ | ✅ | ✅ | — | — | ✅ |
| checkin | RESERVATIONS_CHECKIN | ✅ | ✅ | ✅ | — | — | — |
| checkout | RESERVATIONS_CHECKIN | ✅ | ✅ | ✅ | — | — | — |
| musaitlik | AVAILABILITY_VIEW | ✅ | ✅ | ✅ | — | — | — |
| fiyat | PRICING_VIEW | ✅ | ✅ | ✅ | — | — | — |
| misafirler | GUESTS_VIEW | ✅ | ✅ | ✅ | ✅ | — | — |
| mesajlar | GUESTS_MESSAGE | ✅ | ✅ | ✅ | — | — | — |
| yanitla | GUESTS_MESSAGE | ✅ | ✅ | ✅ | — | — | — |
| yorumlar | GUESTS_REVIEWS | ✅ | ✅ | ✅ | — | — | — |
| odalar | ROOMS_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| odaguncelle | ROOMS_STATUS_EDIT | ✅ | ✅ | — | ✅ | — | — |
| temizlik | [HOUSEKEEPING_VIEW, HOUSEKEEPING_VIEW_OWN] | ✅ | ✅ | — | ✅ | ✅* | — |
| gorevata | HOUSEKEEPING_ASSIGN | ✅ | ✅ | — | ✅ | — | — |
| doluluk | REPORTS_VIEW | ✅ | ✅ | — | — | — | ✅ |

\* `_OWN` yetkisiyle handler `firstMatchingCapability` ile filtreler → sadece `assigned_to = ctx.userId`.

### 7.2 Yeni personel komutları (MVP1)

| Komut | Capability | Sahip | Müdür | Resep. |
|-------|------------|:-----:|:-----:|:------:|
| `/calisanekle` | EMPLOYEES_MANAGE | ✅ | — | — |
| `/calisanyonet` | EMPLOYEES_MANAGE | ✅ | — | — |
| `/duyuru` | ANNOUNCEMENTS | ✅ | ✅ | — |
| `/misafirdavet <telefon> <rezId?>` | GUESTS_INVITE | ✅ | ✅ | ✅ |
| `/cekinlink <rezId>` | PRE_CHECKIN_PUSH | ✅ | ✅ | ✅ |

### 7.3 Misafir komutları (MVP1)

| Komut | Capability | Açıklama |
|-------|------------|----------|
| `rezervasyonum` | RESERVATIONS_VIEW_OWN | Aktif rez bilgisi |
| `rezervasyonlarim` | RESERVATIONS_VIEW_OWN | Lifetime tarihçe (geçmiş + aktif + iptal) |
| `hizmetler` | GUEST_SERVICES_VIEW | Otel hizmet listesi (kahvaltı saati, wifi var/yok, vb.) |
| `wifi` | GUEST_SERVICES_VIEW | Wi-Fi şifre + saat |
| `talep <metin>` | GUEST_REQUEST_CREATE | `otel_guest_requests` insert + resepsiyona WA bildirim |
| `cekin` | GUEST_PRE_CHECKIN_FORM | 72h mekik link gönderir |
| `iptal` | GUEST_RESERVATION_CANCEL | Politika kontrolü → buton onay → status='cancelled' |

---

## 8) DB Migration Listesi (MVP1)

Tek migration dosyası: `supabase/migrations/<TS>_otel_multiuser_v1.sql`

```sql
-- 1. profiles.role 'guest' enum genişletme (TEXT olduğu için constraint yoksa no-op)
-- 2. magic_link_tokens.purpose ve metadata var mı verify, eksikse ekle
-- 3. hotel_employees tablosu
CREATE TABLE IF NOT EXISTS hotel_employees (
  hotel_id UUID NOT NULL REFERENCES otel_hotels(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_hotel_employees_profile ON hotel_employees(profile_id);

-- 4. otel_pre_checkins
CREATE TABLE IF NOT EXISTS otel_pre_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES otel_reservations(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES otel_hotels(id) ON DELETE CASCADE,
  guest_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  id_photo_url TEXT,
  signature_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}',
  kvkk_accepted_at TIMESTAMPTZ,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otel_pre_checkins_rez ON otel_pre_checkins(reservation_id);

-- 5. otel_reservations.pre_checkin_complete
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS pre_checkin_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS guest_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 6. otel_housekeeping_tasks.assigned_to (verify, eksikse ekle)
ALTER TABLE otel_housekeeping_tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 7. otel_guest_hotels (loyalty rollup — MVP1'de boş, MVP2'de cron doldurur)
CREATE TABLE IF NOT EXISTS otel_guest_hotels (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES otel_hotels(id) ON DELETE CASCADE,
  first_visit DATE,
  last_visit DATE,
  total_stays INT NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, hotel_id)
);

-- 8. RLS politikaları (otel_reservations, otel_rooms, otel_guest_messages, otel_guest_requests, otel_pre_checkins)
-- Hot path için service role kullandığımızdan WA tarafı bypass eder; web panel okumalarında devreye girer.
-- Detay: PolicyAddPolicy section'unda her tablo için ayrı.
```

**Not:** SQL migration **kullanıcı Supabase dashboard'dan uygular**. Kod commit eder, kullanıcı SQL'i çalıştırır.

---

## 9) Davet Akışları

### 9.1 Personel davet (`/calisanekle` — bayi clone)

```
WA: /calisanekle
 → 2h magic_link_tokens (purpose='otel-calisan-davet')
 → owner'a buton: "Çalışan ekle linki" → /tr/otel-calisan-davet?t=<token>
 → form: ad + telefon + rol-preset dropdown + capability checkbox + hotel_id (multi-hotel ise)
 → POST /api/otel-calisan-davet/save
   - auth user create
   - profiles insert (role=employee, capabilities, invited_by, metadata.position)
   - hotel_employees insert (hotel_id, profile_id, capabilities) — RLS scope için
   - invite_codes 6-hex pending
   - WA → çalışan: "Kayıt kodun: ABC123"
```

### 9.2 Misafir davet (`/misafirdavet`)

```
WA: /misafirdavet 905551234567 [rezId?]
 → resepsiyon yazar, GUESTS_INVITE cap kontrolü
 → davet kodu üretilir (8-hex, invite_codes tablosu, role=guest, hotel_id metadata)
 → WA → misafir: "Marina Resort'a hoş geldiniz. Kod ile bağlanın: A1B2C3D4
                  Tıkla: https://wa.me/31644967207?text=OTEL:A1B2C3D4"
 → misafir kod yazar → router invite_codes flow:
   - profile create (role=guest, capabilities=GUEST_PRESET, metadata.invited_for_hotel_id, lifetime)
   - WA → misafir: rol-spesifik welcome + komut listesi
```

**Lifetime kuralı:** Misafir `role='guest'` profili **hiçbir zaman silinmez/sessizleşmez**. Capability'ler de sıfırlanmaz. Marketing/loyalty mesajı için **`marketing_opt_in=true`** ek koşulu (transactional mesajlar opt-in gerektirmez).

### 9.3 WA Business uyumluluk

- Davet anında KVKK linki + opt-in seçeneği gösterilir
- 24h serbest mesaj penceresi dışında **template** mesaj gerekir (Meta WA policy)
- Marketing kategorisi mesajlar `marketing_opt_in=true` olmadan **YASAK**

---

## 10) MVP1 Yol Haritası — Pipeline mode

| Faz | İçerik | Süre | Commit |
|-----|--------|------|--------|
| **A** | `src/tenants/otel/capabilities.ts` + `requiredCapabilities` map + config groups (Yönetim+Muhasebe) | 1-2h | `feat(otel): capability registry + requiredCapabilities map` |
| **B** | SQL migration (`hotel_employees`, `otel_pre_checkins`, `otel_guest_hotels`, RLS) + resolver fonksiyonu `getEffectiveCapabilities` | 2-3h | `feat(otel): hotel_employees + RLS + multi-property resolver` |
| **C** | `/calisanekle` + web form clone'u + save API + role presetler dropdown | 3-4h | `feat(otel): personel davet web formu + /calisanekle` |
| **D** | role=guest + GUEST_PRESET + `/misafirdavet` + 5 misafir komut handler'ı (rezervasyonum, rezervasyonlarim, hizmetler, wifi, talep) | 3-4h | `feat(otel): misafir lifetime rolü + WA komutları` |
| **E** | `otel-cekin` mekik form + API + `cekin` + `/cekinlink` + cron T-24h job | 4-5h | `feat(otel): online check-in mekik form + cron` |

**Toplam tahmin:** 13-18 saat. Pipeline mode → her faz biter bitmez `git commit && git push`.

**Build hatası dışında dur kararı verme** (kullanıcı talimatı).

---

## 11) Açık tradeoff'lar (karar alındı, not için)

- **K1 lifetime guest:** GDPR/KVKK için manuel silme mekanizması var (admin panelden), ama otomatik silme yok — kullanıcı tercihi.
- **K2 mekik UX:** WA'da manage edilemeyecek karmaşıklıkta hiçbir misafir akışı yok MVP1'de — sadece check-in. İptal/yorum/ek-hizmet MVP2.
- **K3 multi-tenant:** `hotel_employees` mevcut `profiles.capabilities`'i **override** eder, fallback olarak korunur. Bu, "tek otelliler için kolay başlangıç + ölçeklenince zincir desteği" sağlar.
- **K4 check-in MVP1:** Cron job + 72h multi-use token + atomik insert; resepsiyon notif `PRE_CHECKIN_VIEW`'a göre.
- **K5 brand MVP2:** MVP1'de `otel_hotels.name` brand görevi görür (yer-tutucu). Persona/wa_phone Faz 2.
