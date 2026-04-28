# Bayi Multi-User + Permission — Tasarım Önerisi (2026-04-27)

> Bu dosya **`.planning/bayi-multiuser-plan.md`'nin (2026 başı) yerine geçmiyor, üstüne geliyor.** Eski plan tasarım aşamasında yazılmış; bu dosya kodun bugünkü haline bakarak **eksikleri ve iyileştirmeleri** çıkarıyor.

## TL;DR

Bayi'de "tek UPU + per-user capability" pivot'u **24 Nisan 2026 itibariyle yapılmış** (`feat(bayi): capability-based menu filtering + çalışan davet web akışı` — commit 401ec3b). Yani **istenen mimari büyük ölçüde mevcut**. Eski plan'daki `permissions JSONB` modeli **tamamen capability stringleri (`text[]`) ile değiştirilmiş**.

Bu öneri: kod gerçeği ile eski plan arasındaki farkı dokümante eder ve **kalan boşlukları** kapatmak için somut iyileştirmeler önerir.

> **Not (emlak vs bayi):** Brief'te "emlak'ın son halini incele, bayi de aynısını yap" denmiş. Kod gerçeğinde **TAM TERSİ** durum var: bayi capability gate'lerini kurmuş (`bayi/commands/index.ts requiredCapabilities`), emlak henüz **kurmamış** (`emlak/commands/index.ts`'de `requiredCapabilities` map'i yok, capability override'ı yok). Yani bayi referans, emlak'a aynı şablonu sonra uygulanacak. Brief'in tersini doğrulamak gerekirse `git log -- src/tenants/{emlak,bayi}/commands/` karşılaştırılabilir.

---

## 1. Mevcut emlak'ta gördüklerim

### 1.1 emlak'ın bugünkü hali
- `emlak/commands/index.ts` — `requiredCapabilities` **yok**. Tüm komutlar herkes tarafından çalışır.
- `emlak/onboarding-flow.ts` — single-user (advisor): ad, ofis, bölge, email, deneyim, brifing.
- `emlak`'ta `role`/`capabilities` kullanılmıyor; "tek danışman = tek hesap" varsayımı.
- WA menüsünde sahibinden uzantı kurulumu (Chrome ext) emlak-only.
- Web panel akışı: `mulkekle-form`, `sunum`, `musteri-ekle-form`, `profil-duzenle`, `web-sayfam`, `mulklerim`, `sozlesme/sign`. **Hepsi tek-kullanıcı.**

### 1.2 Çıkarım
Emlak henüz multi-user'a açılmamış. Briefing'te bahsedilen "tek UPU + farklı yetki" önce **bayi'de tamamlanmış**, emlak'a bu pattern sonra geri taşınacak. Yani bu tasarım emlak için referans olur.

---

## 2. Mevcut bayi altyapısı (kod gerçeği — 2026-04-27)

### 2.1 Veri modeli (live `profiles` satırından doğrulandı)

`profiles` kolonları: `id, tenant_id, email, display_name, phone, role, telegram_chat_id, whatsapp_phone, preferred_locale, favorite_commands, kvkk_consent_at, metadata, created_at, updated_at, dealer_id, permissions, invited_by, capabilities`

| Kolon | Tip | Anlam |
|---|---|---|
| `role` | text (default `'admin'`) | `admin` \| `employee` \| `dealer` \| `system` \| `user` |
| `capabilities` | text[] (default `'{}'`) | `["orders:create", "finance:balance-own", ...]`. `'*'` = wildcard (owner) |
| `invited_by` | uuid → profiles | "Bu çalışanı kim ekledi" |
| `dealer_id` | uuid → bayi_dealers | Dealer rolü için bağlı bayi |
| `permissions` | jsonb (legacy) | **Eski model — kullanımdan kaldırılmış. Temizlenmeli (Bkz. §6.4).** |
| `metadata` | jsonb | onboarding cevapları, position, dealer_count, briefing_enabled |

Yardımcı tablolar:
- `magic_link_tokens(token, user_id, expires_at, used_at)` — tek kullanımlık web form linki (çalışan davet 2h)
- `bayi_invite_links(code, tenant_id, created_by, role, max_uses, used_count, is_active)` — çoklu kullanımlık dealer davet kodu
- `invite_codes(code, tenant_id, user_id, status)` — çalışanın WA'da kodu yazıp kayıt tamamlaması için
- `saas_active_session(phone, active_saas_key, view_as_role)` — owner'ın "bayi/employee görünümüne geç" özelliği
- `subscriptions(user_id, tenant_id, plan, status)` — trial otomatik
- `bayi_dealers` — bayi işyeri kaydı (kod tabanında onboarding step'ler bunu yazıyor)

### 2.2 Capability registry — `src/tenants/bayi/capabilities.ts`

```ts
export const BAYI_CAPABILITIES = {
  ORDERS_CREATE, ORDERS_VIEW, ORDERS_CANCEL, ORDERS_VIEW_OWN,
  DEALERS_INVITE, DEALERS_VIEW, DEALERS_EDIT,
  STOCK_VIEW, STOCK_EDIT, STOCK_PURCHASE,
  FINANCE_INVOICES, FINANCE_PAYMENTS, FINANCE_BALANCE,
  FINANCE_INVOICES_OWN, FINANCE_BALANCE_OWN,
  CAMPAIGNS_CREATE, CAMPAIGNS_VIEW,
  DELIVERIES_VIEW, DELIVERIES_ASSIGN,
  PRODUCTS_VIEW, PRODUCTS_EDIT,
  REPORTS_VIEW, EMPLOYEES_MANAGE,
}
export const OWNER_ALL = "*"            // owner default
export const DEALER_PRESET = [...]      // bayi davet acceptance default
export function hasCapability(userCaps, required) { ... }
```

### 2.3 Router gate — `src/platform/whatsapp/router.ts`

```ts
function hasCommandCapability(registry, userCaps, cmd) {
  const req = registry.requiredCapabilities?.[cmd];
  if (!req) return true;
  if (userCaps.includes("*")) return true;
  const list = Array.isArray(req) ? req : [req];
  return list.some(r => userCaps.includes(r));
}
```

`bayi/commands/index.ts → requiredCapabilities` 40+ komut için tek tek doldurulmuş. `cmd:foo` callback, text command, AI intent — **hepsi gate'ten geçiyor**.

### 2.4 Çalışan davet akışı (mevcut)

1. Owner WA'da `/calisanekle` veya menüden "Çalışan Ekle" → magic_link_tokens'a 2h token yazılır.
2. WA mesajı: "📝 Davet Formunu Aç" → `https://retailai.upudev.nl/tr/bayi-calisan-davet?t=<token>`.
3. Owner web formda: ad + telefon + pozisyon + **capability checkbox listesi** (CAPABILITY_LABELS group'lara göre gruplu).
4. Submit → `/api/bayi-calisan-davet/save`:
   - magic token doğrulanır
   - `auth.users` placeholder email ile yeni kullanıcı
   - `profiles` insert: `role='employee'`, `capabilities=[...]`, `invited_by=owner.id`, `metadata.position`
   - `invite_codes` insert (6-hex)
   - `subscriptions` trial
   - Çalışana WA: `Kayıt kodunuz: A1B2C3` + "Başla" butonu
   - Owner'a WA: `✅ Çalışan davet edildi`
5. Çalışan WA'dan kodu yazınca `invite_codes.status='used'` ve profile'ı kendi telefonuyla bağlanır.

### 2.5 Bayi davet akışı (mevcut)

1. Owner `/bayidavet` → `bayi_invite_links` çoklu kullanımlık 4-hex kod.
2. wa.me deep link: `https://wa.me/31644967207?text=BAYI:CODE...`
3. Yeni kullanıcı tıklayıp mesaj atınca → webhook tarafında `BAYI:` prefix'i tanınıp `dealer_onboard` session'ı başlatılıyor.
4. 7 adım: firma → yetkili → kuruluş yılı → ürün grupları → email → vergi no → şehir/ilçe.
5. `bayi_dealers` kaydı + `profiles.dealer_id` link, `capabilities = DEALER_PRESET`.

### 2.6 Owner görünümü değiştirme — `/degistir`

Owner WA'da `/degistir` → `degistir_role:dealer` veya `degistir_role:employee` → `saas_active_session.view_as_role` set ediliyor → menü o role'e göre filtreleniyor. **Yalnız "generic dealer" / "generic employee" görünümü** — spesifik bir çalışanı önizlemiyor (Bkz. §6.2).

---

## 3. Önerilen rol modeli (bayi'ye özel)

Mevcut 3 rol yeterli — yeni rol önermiyorum. Onun yerine **çalışan rolünü "preset capability paketleri" ile özelleştir**.

| Rol | Kim | Capability | Notlar |
|---|---|---|---|
| **owner** (`role=admin`) | Firma sahibi | `["*"]` (wildcard) | Davet bayi onboarding'inden geçen ilk kullanıcı |
| **employee** (`role=employee`) | Çalışan | Owner'ın seçtiği capability listesi (preset veya custom) | `invited_by` set |
| **dealer** (`role=dealer`) | Bayi ağındaki bayi | `DEALER_PRESET` + custom (Bkz. §6.5) | `dealer_id` set |

### 3.1 Çalışan preset'leri (yeni — §6.1)

Owner çalışan davet formunda **tek tıkla preset seçmeli**:

| Preset | Capability'ler |
|---|---|
| 💰 Satış Müdürü | `CAMPAIGNS_CREATE`, `CAMPAIGNS_VIEW`, `ORDERS_VIEW`, `REPORTS_VIEW`, `DEALERS_VIEW` |
| 🤝 Satış Temsilcisi | `ORDERS_CREATE`, `ORDERS_VIEW`, `DEALERS_VIEW`, `PRODUCTS_VIEW`, `CAMPAIGNS_VIEW` |
| 💳 Muhasebeci | `FINANCE_INVOICES`, `FINANCE_BALANCE`, `FINANCE_PAYMENTS`, `REPORTS_VIEW` |
| 📋 Tahsildar | `FINANCE_PAYMENTS`, `FINANCE_BALANCE` (read-only invoice yok) |
| 📦 Depocu | `STOCK_VIEW`, `STOCK_EDIT`, `STOCK_PURCHASE`, `PRODUCTS_VIEW` |
| 🚛 Lojistikçi | `DELIVERIES_VIEW`, `DELIVERIES_ASSIGN`, `ORDERS_VIEW` |
| 🏷 Ürün Yöneticisi | `PRODUCTS_VIEW`, `PRODUCTS_EDIT`, `STOCK_VIEW` |
| ✏️ Özel | (boş — owner manuel seçer) |

Tek tıklama preset → checkbox'lar otomatik dolu → owner istediğini ekleyip çıkarır. Preset'ler sadece `BAYI_PRESETS` dict olarak `capabilities.ts`'e eklenir, DB değişimi gerekmez.

---

## 4. DB değişiklikleri

Tablo prefix kuralına uyarak (`bayi_*`) ve `profiles` shared olduğu için minimal:

### 4.1 `profiles` üzerinde değişiklik **yok** (gerekenler zaten var)

Mevcut: `role`, `capabilities`, `invited_by`, `dealer_id`. Hepsi yeterli.

### 4.2 Yeni — `bayi_employee_audit` (öneri, opsiyonel)

```sql
CREATE TABLE bayi_employee_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),
  actor_id     uuid REFERENCES profiles(id),  -- kim yaptı (owner)
  target_id    uuid REFERENCES profiles(id),  -- kime
  action       text,                          -- 'invite' | 'cap_add' | 'cap_remove' | 'deactivate' | 'reactivate' | 'delete'
  payload      jsonb,                         -- {capabilities: [...], reason?: string}
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_bayi_employee_audit_target ON bayi_employee_audit(target_id);
CREATE INDEX idx_bayi_employee_audit_actor ON bayi_employee_audit(actor_id);
```

**Neden:** Owner çalışanın yetkisini değiştirdiğinde geçmiş kalmalı (uyuşmazlık çıkarsa "ne zaman bu yetkiyi sen verdin" gösterilebilsin).

### 4.3 `profiles.is_active` (önerilir)

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = false;
```

**Neden:** Mevcut `calisan.ts` `/calisanekle:sil_ok` çalışanı `DELETE` ediyor → sipariş/tahsilat fk-referansı kırılır. Soft-delete gerekiyor: `is_active=false`. Router gate'inde `is_active=false` ise "hesabınız pasifleştirilmiş, yöneticinize başvurun" mesajı.

### 4.4 `profiles.permissions` (legacy jsonb) → drop (Faz 2'de)

Code search doğrulandı: hiçbir yerde okunmuyor. Migration ile drop:
```sql
ALTER TABLE profiles DROP COLUMN IF EXISTS permissions;
```
**Riski:** Eski tools/migrations'a referans varsa kırılır. **Önce `git grep "permissions"` ile temiz olduğunu doğrula**, sonra drop.

---

## 5. Onboarding akışı (iyileştirme)

### 5.1 Mevcut bayi-sahibi onboarding (3 adım) çok yetersiz

Şu an: `company_name` → `dealer_count` → `briefing`. **Bayi ofisinin temel bilgileri yok** (telefon, email, adres, sektör).

### 5.2 Önerilen 6 adım

```
1. company_name        — Firma adı
2. owner_name          — Yetkili adı (display_name'e yazılsın)
3. industry            — Sektör (boya/inşaat/elektrik/tesisat/hırdavat/klima/mobilya/gıda/diğer — buton seçenek)
4. dealer_count        — Bayi sayısı (mevcut)
5. briefing            — Günlük brifing (mevcut)
6. invite_team         — "Çalışanlarınızı şimdi davet eder misiniz?" (Evet → /calisanekle, Hayır → menü)
```

`industry` alanı brifing kişiselleştirmesi + AI agent kontekst'i için değerli. `metadata.industry` jsonb'a yazılır, schema değişimi gerekmez.

### 5.3 Onboarding sonu — çalışan davet promosyonu (yeni)

Mevcut `onFinish` "Hazırsınız! Ürün eklemek için..." diyor. Sonuna ek button:
```
[ 📦 Ürün Ekle ]   [ 👥 Çalışan Davet Et ]
```
Çoğu firma sahibi tek başına yapamaz, çalışan eklemeyi onboarding'in doğal devamı yapmalı.

---

## 6. WA UX — kalan boşluklar ve öneriler

### 6.1 Çalışan davet web formu — preset selector (yüksek öncelik)

`/tr/bayi-calisan-davet` sayfasının başına dropdown:
```
┌─────────────────────────────┐
│ Hazır Rol Seç ▾             │
├─────────────────────────────┤
│ 💰 Satış Müdürü             │
│ 🤝 Satış Temsilcisi         │
│ 💳 Muhasebeci               │
│ 📋 Tahsildar                │
│ 📦 Depocu                   │
│ 🚛 Lojistikçi               │
│ 🏷 Ürün Yöneticisi          │
│ ✏️ Özel (manuel)            │
└─────────────────────────────┘
```
Seçim → checkbox'lar otomatik tıklanır. Owner ekleme/çıkarma yapabilir. **DB değişimi yok**, salt frontend.

### 6.2 `degistir_role:employee` — spesifik çalışan seçilebilsin

Mevcut "Çalışan Görünümü" generic — sadece `view_as_role='employee'` set ediyor ama capability'leri kimden alacağı belli değil (kod commit eden insanın `view_as_role`-aware capability okuma logic'ini henüz tamamlamamış olabilir; **doğrula**).

Öneri:
```
/degistir → "Çalışan Görünümü" seçilince
  → Mevcut çalışanların listesi (sendList)
  → Çalışan seçilince saas_active_session.view_as_employee_id = empId
  → router.ts capability'leri o çalışanın profile'ından alır
```

`saas_active_session`'a yeni kolon: `view_as_user_id uuid`. Owner böylece **gerçekten** çalışanın gördüğü menüyü görür.

### 6.3 Yetki düzenleme (kritik eksik)

Şu an `calisanekle:detay:<empId>` butonu sadece "Sil" gösteriyor. **"Yetki Düzenle" butonu yok** — owner çalışanın yetkilerini sonradan değiştiremiyor (silip yeniden eklemek zorunda — kötü UX, audit kayboluyor).

Çözüm:
```
calisanekle:detay:<empId>
  → [ ✏️ Yetki Düzenle ]  [ ⏸ Pasifleştir ]  [ 🗑 Sil ]
   ↓
"Yetki Düzenle" → magic_link 2h → /tr/bayi-calisan-davet?t=...&edit=<empId>
   web form: ad/telefon read-only, capability checkbox'ları mevcut yetkilerle pre-fill, submit ile UPDATE
```

`/api/bayi-calisan-davet/save` POST'a `edit` mode ekle: `empId` varsa INSERT yerine UPDATE + `bayi_employee_audit` insert.

### 6.4 Pasifleştirme (yeni)

Soft-delete olarak `is_active=false`. WA'da çalışana otomatik bildirim: "Hesabınız geçici olarak pasifleştirildi." Router gate çalışanın komutlarını "hesabınız pasif" mesajıyla reddetmeli. Owner istediğinde reaktive edebilir.

### 6.5 Dealer içinde çoklu kullanıcı (gelecek faz)

Şu an: 1 telefon = 1 dealer profile. Ama gerçekçi olarak bir bayi ofisinde 2-3 kişi olabilir.

Çözüm önerisi (faz 5+):
- `bayi_dealers` zaten var → o bayiye bağlı tüm `profiles` `dealer_id=<bayiId>` ile bağlanır.
- Bayi sahibi ilk kayıt, "ek kullanıcı ekle" komutu ile alt kullanıcı ekleyebilir.
- Capability: `DEALER_PRESET` + opsiyonel `ORDERS_CREATE` (sadece sipariş alan), `FINANCE_BALANCE_OWN` (sadece bakiye gören).
- Bu Faz-1 kapsamı dışı — ilerideki ihtiyaç olarak not edilsin.

### 6.6 Capability hiyerarşi (öneri)

`hasCapability` şu an düz string match. Mantıklı genişleme:
- `ORDERS_VIEW` ⇒ `ORDERS_VIEW_OWN` (üst görüş alt görüşü kapsar)
- `STOCK_EDIT` ⇒ `STOCK_VIEW`
- `PRODUCTS_EDIT` ⇒ `PRODUCTS_VIEW`
- `FINANCE_PAYMENTS` ⇒ `FINANCE_BALANCE`

Implementation:
```ts
const IMPLIES: Record<string, string[]> = {
  [BAYI_CAPABILITIES.ORDERS_VIEW]: [BAYI_CAPABILITIES.ORDERS_VIEW_OWN],
  [BAYI_CAPABILITIES.STOCK_EDIT]: [BAYI_CAPABILITIES.STOCK_VIEW],
  // ...
};
function hasCapability(userCaps, required) {
  if (userCaps.includes("*")) return true;
  if (userCaps.includes(required)) return true;
  return userCaps.some(c => (IMPLIES[c] || []).includes(required));
}
```

**Neden önemli:** Müdürün hem `ORDERS_VIEW` hem `ORDERS_VIEW_OWN` capability'ye sahip olması gerekmiyor — `ORDERS_VIEW` zaten her şeyi görür, `OWN` filtre dealer'a özel. Hiyerarşi olmazsa preset'leri tek tek doldurmak gerekir.

### 6.7 Talimat sistemi — iki yönlü hale getir

Mevcut: owner → employee tek-yönlü mesaj. Eklenecek:
- Çalışan talimatı aldığında inline butonlar: `✅ Tamamlandı` / `❓ Soru var`
- "Tamamlandı" → owner'a otomatik bildirim + `bayi_tasks` tablosuna kayıt (yeni tablo veya `agent_tasks` reuse).
- Bu Faz-2 kapsamı.

### 6.8 Çalışan kayıt bekliyor → hatırlatma (yeni)

Çalışan davet edildi ama 24h içinde kodu yazmadıysa:
- Cron `cron/employee-invite-reminder` (sabah günde 1 kez)
- `profiles WHERE role='employee' AND whatsapp_phone IS NULL AND created_at < now()-24h AND created_at > now()-7d` listesi
- Owner'a: "👥 3 çalışanınız henüz kaydolmadı: Ali, Ayşe, Mehmet. Tekrar davet göndermek ister misiniz?"
- Vercel cron limiti dolu olabilir → mevcut `admin-alerts` cron'a piggyback.

---

## 7. Açık sorular / tradeoff'lar

1. **Capability'lerin görünür ismi** — `"orders:create"` mi, `"Sipariş oluştur"` mu, owner WA'da görsün? Şu an checkbox'larda `CAPABILITY_LABELS` kullanılıyor (Türkçe), ama WA mesajında "🔑 5 kalem yetki" deniyor. Owner ne verdiğini hatırlasın diye **WA'da da label göster**: "Yetkiler: Sipariş oluştur, Bayi görüntüle, Kampanya oluştur, +2 daha"

2. **Bayi hesabı = telefon mu, firma mı?** — Şu an aynı telefonu owner ve dealer'a bağlamak teorik mümkün ama saas_active_session sadece SaaS-key seviyesinde. Bir kişi hem owner (kendi firması) hem dealer (başka firmanın bayisi) ise UX karmakarışık olabilir. **Karar:** ilk faz tek-rol ön kabul, multi-rol ileride.

3. **Çalışan ayrılınca verisi ne olur?** — soft-delete (is_active=false) yapılsa siparişler/tahsilat'lar referans korur. Hard-delete yaparsak `created_by` foreign key NULL olur, geçmiş bozulur. **Tavsiye:** Hard-delete tamamen kaldır, sadece soft-delete + (gerekirse) data anonymization.

4. **DEALER_PRESET sabit, owner customize edemiyor** — bazı sektörlerde dealer'a "siparişini iptal etme" yetkisi vermek istenebilir. Çözüm: `bayi_invite_links.permissions jsonb` alanı zaten var ama kullanılmıyor. Davet linki oluşturulurken owner "bu davet linkiyle gelen bayilere ekstra yetki ver" diyebilir. **Mevcut UI'da yok**, eklenirse iyi olur ama Faz-1 dışında.

5. **AI intent + capability gate sıralaması** — `router.ts` line 487: AI intent detect → command lookup → capability check. Düşük güvenli AI intent yetkili olmayan komutu tetiklerse kullanıcıya "yetkin yok" diyor; bu doğru ama AI'a fazla güvenirsek "owner yetkisini kullan" gibi bir intent kullanıcıyı şaşırtabilir. **Tradeoff:** intent'te `intent.command`'i registry.commands AND user.capabilities'e karşı pre-filter et — kullanıcı görmediği komutu AI tetiklemesin.

6. **`view_as_role` capability okuma** — Router `ctx.capabilities` alanını profile'dan dolduruyor (varsayım). `view_as_role` set olunca kim olarak filtrelenir? `ctx.role` veya `ctx.capabilities` view_as'a göre yeniden hesaplanmalı. **Doğrulanmalı:** `ctx`'i populate eden middleware/webhook view_as_role'ü dikkate alıyor mu yoksa salt menüyü mü filtreliyor (yani capability gate gerçek profile'dan mı okuyor)? Kod taramasında bu logic net değil — review gerekiyor.

7. **emlak'a aynı sistemi taşımak** — bayi referans alınırsa: `EMLAK_CAPABILITIES` (PROPERTIES_*, CUSTOMERS_*, PRESENTATIONS_*, CONTRACTS_*), `emlak/commands/index.ts requiredCapabilities`, `/emlak-calisan-davet` web form vs. **Bu apayrı bir görev**, bu dokümana sokmuyorum.

---

## 8. Önerilen iş paketleri (öncelik sırası)

### Faz 1 — Quick Wins (kod tek pass, DB minor)
- **§6.1** Davet formuna preset selector ekle (`capabilities.ts`'e `BAYI_PRESETS` + frontend dropdown). _~2h._
- **§6.6** Capability hiyerarşi (`IMPLIES` map). _~1h._
- **§5.2** Onboarding'i 3→6 adıma çıkar (`bayi/onboarding-flow.ts`). _~1h._
- **§5.3** Onboarding finish'inde "Çalışan Davet" CTA. _~30m._
- **§6.7** Talimat'a "✅ Tamamlandı" butonu (yeni `agent_proposals` reuse veya `bayi_tasks`). _~3h._

### Faz 2 — Yetki yaşam döngüsü
- **§4.3** `profiles.is_active` migration. _~30m._
- **§6.4** Pasifleştir/reaktive et akışı (calisan.ts + router gate). _~2h._
- **§6.3** Yetki düzenleme web flow (mevcut form'u edit modu desteklesin). _~3h._
- **§4.2** `bayi_employee_audit` tablosu + her cap-değişikliğinde insert. _~2h._

### Faz 3 — Görünüm + UX iyileştirme
- **§6.2** `view_as_user_id` — spesifik çalışan önizleme. _~3h._
- **§6.8** Kayıt bekleyen çalışan hatırlatma cron. _~2h._
- **§7.1** WA'da capability label'larını gerçekten göster (calisanyonet detay'da). _~30m._

### Faz 4 — Cleanup
- **§4.4** `profiles.permissions` legacy kolonu drop. _~1h (önce grep + verify)._
- **§7.6** view_as_role capability okuma path'ini doğrulayıp düzelt. _~2h._

### Faz 5+ — İleride (kapsam dışı, not)
- **§6.5** Dealer-içi multi-user.
- **§7.4** Bayi davet linkinde özel capability ekleme.
- emlak'a aynı sistem migration'ı.

---

## 9. Kararlar / öneriler — onay bekliyor

Aşağıdaki kararları kullanıcı onayladıktan sonra Faz 1 koduna geçilebilir:

1. ✅/❌ Eski `bayi-multiuser-plan.md`'yi olduğu gibi bırak (tarihi referans), bu dosyayı yeni canlı plan olarak kullan?
2. ✅/❌ Faz 1 öncelikleri kabul mü, yoksa farklı bir öncelik var mı?
3. ✅/❌ `profiles.permissions` (legacy jsonb) drop edilebilir mi? (Önce kod grep + Supabase'de direkt SELECT kullanan başka servis var mı kontrol gerekli.)
4. ✅/❌ Çalışan preset listesi (§3.1) yeterli mi, eklenmesi gereken var mı?
5. ✅/❌ Onboarding 6 adım kabul, sektör (industry) listesi (§5.2) yeterli mi?
6. ✅/❌ Soft-delete (is_active) hard-delete'in yerini almalı mı?
