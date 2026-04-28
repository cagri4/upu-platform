# Bayi — Bug Fix + Discovery Chain Tasarımı (2026-04-28)

İki iş tek doküman:
- **A)** Yetki bug'ı (yeni owner `capabilities=[]`) — sebep + minimal fix
- **B)** Bayi için onboarding-sonrası discovery chain (emlak'a paralel)

---

## A) Bug Raporu — Yeni owner'a yetki gelmiyor

### A.1 Tespit (live DB doğrulandı)

`profiles.id = c5094fdd-6ad5-4c40-b1ca-6bd954f522c7` ("Ab dağıtım", 2026-04-28 11:11 kayıt):

```json
{ "role": "admin", "capabilities": [], "invited_by": null,
  "metadata": { "company_name": "Ab dağıtım", "dealer_count": "50+", ... } }
```

`role=admin` doğru, ama `capabilities=[]` boş → router `hasCommandCapability(reg, [], 'yeniurun')` `PRODUCTS_EDIT`'i bulamaz → **"Bu işlem için yetkin yok."**

### A.2 Sebep (kod path izi)

Kayıt yolu: WA mesajı `BAYI:CODE` → `src/app/api/whatsapp/route.ts:206` BAYI prefix yakaladı → `bayi_invite_links` doğruladı → `profiles` INSERT (line 263).

```ts
// route.ts:256-272
const role = (inviteLink.role as string) || "dealer";
let dealerCaps: string[] = [];
if (role === "dealer") {
  const { DEALER_PRESET } = await import("@/tenants/bayi/capabilities");
  dealerCaps = [...DEALER_PRESET];
}
await supabase.from("profiles").insert({
  ...
  role,
  capabilities: dealerCaps,   // ← role !== 'dealer' ise [] kalıyor
  ...
});
```

`bayi_invite_links.role` 'admin' olabilir; o zaman `dealerCaps = []` ve owner'a hiç capability atanmıyor.

**Aynı bug 4 yerde:**

| Yer | Path | Senaryo | Şu anki davranış |
|---|---|---|---|
| `src/app/api/whatsapp/route.ts:263` | BAYI:CODE flow | role admin/employee/user | `capabilities: []` |
| `src/app/api/whatsapp/route.ts:395` | invite_links (universal) | her rol | **capabilities alanı INSERT'te hiç yok** → DB default `'{}'` |
| `src/app/api/auth/register/route.ts:34` | Klasik web kayıt (email/password) | her rol | `capabilities` INSERT'te yok |
| `src/app/api/admin/invite/route.ts:77` | Admin panel davet | (kontrol edilmedi, muhtemelen aynı) | aynı |

Ayrıca `bayi_invite_links` (Ab dağıtım'ın geldiği yer) için **`bayi_invite_links.role`'in 'admin' olarak set edildiği bir yer var mı?** kontrol edilmeli; eğer `role='dealer'` olsaydı `DEALER_PRESET` set olurdu. Muhtemelen `Ab dağıtım`, kullanıcının kendi telefonunu bayi-davet linkiyle test ettiği için `role` admin olarak gelmedi — başka bir yoldan kayıt olmuş olabilir. Yine de bug aynı: `role='admin'` herhangi bir kayıt yolunda `capabilities` boş kalıyor.

### A.3 Fix önerisi (minimal, 4 INSERT site)

Capability default policy'sini kodla netleştir. Yeni helper:

```ts
// src/tenants/bayi/capabilities.ts
export function defaultCapabilitiesForRole(role: string): string[] {
  if (role === "admin" || role === "user") return [OWNER_ALL];
  if (role === "dealer") return [...DEALER_PRESET];
  if (role === "employee") return []; // owner sets via davet form
  return [];
}
```

Kullanım (4 INSERT site'inde):
```ts
capabilities: defaultCapabilitiesForRole(role),
```

Aynı semantik diğer tenant'lar için de gerekecek (gelecek). Şimdilik **bayi-only senaryoda** kullanıyoruz; emlak/diğerleri capability gate'ini kullanmadığı için boş array sorun değil.

> **Alternatif** — DB-side trigger: `BEFORE INSERT ON profiles` trigger'ı `role='admin'` ise `capabilities='{*}'` set etsin. Daha az kod ama gizli davranış (debug zor). **Tavsiyem: helper kullan, kodda görünür kalsın.**

### A.4 Hotfix: mevcut Ab dağıtım kullanıcısı

```sql
UPDATE profiles
SET capabilities = ARRAY['*']
WHERE id = 'c5094fdd-6ad5-4c40-b1ca-6bd954f522c7'
  AND role = 'admin'
  AND capabilities = '{}';
```

**CLAUDE.md kuralı:** "user data'yı UPDATE etmeden önce sor." → bu fix kullanıcı onayı ile çalıştırılır.

Geriye dönük tüm boş-cap admin'leri tespit için:
```sql
SELECT p.id, p.display_name, p.created_at
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE t.saas_type = 'bayi'
  AND p.role IN ('admin', 'user')
  AND (p.capabilities = '{}' OR p.capabilities IS NULL);
```

Onay sonrası tek migration ile hepsi seed edilir.

### A.5 Toplam iş: ~15 dk
- 1 yeni helper (`defaultCapabilitiesForRole`) + 4 INSERT site update
- 1 hotfix UPDATE (kullanıcı onayı)
- 1 backfill query (kullanıcı onayı)

---

## B) Discovery Chain Tasarımı — Bayi

### B.1 Emlak referans akışı (kod gerçeği)

```
WA: "BAYI:CODE" / invite link
  → BAYI/invite handler (route.ts)
  → startIntro (intro.ts) — emlak-only şu an
       ├─ Yetenek tanıtımı (sendText)
       ├─ Demo arama formu link (/tr/ara?t=...)  [magic 7d]
       └─ profiles.metadata.onboarding_completed=true, discovery_step=0

  ── kullanıcı /tr/ara'da bir arama yapar ──
  → /api/ara/save POST
       └─ after(): "🎯 Takip Kur" link (/tr/takip?t=...)

  ── kullanıcı /tr/takip'te kriter kaydeder ──
  → /api/takip/save POST
       └─ after(): "✅ Mülk Ekle" link / WA

  ── /api/mulkekle/save ──
       └─ advanceDiscovery(userId, phone, "mulk_eklendi")
       → discovery-chain.ts step 1 prompt: "🎯 Sunum Hazırla"

  ── /api/sunum/finish ──
       └─ advanceDiscovery(..., "sunum_hazir") → step 2: "📡 Tarama Kur"
       └─ ... step 3 → step 4 (chain bitir)
```

Pattern özeti:
1. **Intro = web demo değer göster** — kayıt sonrası çıt çıt, aha-an
2. **Her save endpoint'i `after()` içinde sonraki magic link'i basar**
3. **`discovery-chain.ts` step state machine** — `profiles.metadata.discovery_step` kaymak
4. **Magic linkler 7d TTL** (intro 2h çok kısa olduğu için 7d'ye genişletilmiş)
5. **Kullanıcı chain'i terk edebilir** — ana menüden komut çalıştırınca chain pause; eylem step trigger'ına eşleşirse devam

### B.2 Bayi için akış önerisi (6 adım)

Mantıksal ilerleme: **firma profili → ürün → bayi ağı → ilk sipariş → kampanya → web panel keşfi**.

```
1. Onboarding bitti (3 adım: company_name → dealer_count → briefing)
   ↓ [onFinish]
   "✅ Kurulum tamam! Sırada: firma profilinizi tamamlayalım."
   [📝 Firma Profilim]  → magic /tr/bayi-firma-profil?t=...   ← YENİ web sayfa

2. Firma profili kaydedildi
   /api/bayi-firma-profil/save → after():
   "✅ Profil hazır. Şimdi ilk ürününüzü kataloğa ekleyelim."
   [📦 Ürün Ekle]  → magic /tr/bayi-urun-ekle?t=...   ← YENİ web sayfa

3. Ürün eklendi
   /api/bayi-urun-ekle/save → after() + advanceDiscovery("urun_eklendi"):
   "🎉 İlk ürün eklendi! Şimdi bayilerinizi sisteme davet edelim."
   [🏪 Bayi Davet]  → /bayidavet WA komutu (mevcut, çoklu kullanım kod üretir)
   VEYA [👤 Tek Bayi Ekle]  → magic /tr/bayi-ekle?t=... (manuel firma kaydı)   ← YENİ

4. İlk bayi eklendi (link kullanıldı veya manuel)
   route.ts BAYI:CODE handler / /api/bayi-ekle/save → after():
   "✅ Bayi ağınız büyümeye başladı! Şimdi bir demo sipariş oluşturalım."
   [🛒 Sipariş Oluştur]  → /siparisolustur WA flow (mevcut, 5-adım)

5. İlk sipariş oluşturuldu
   /siparisolustur step finish → advanceDiscovery("siparis_olustu"):
   "🎯 Harika! Bayilerinize özel bir kampanya başlatmak ister misiniz?"
   [📣 Kampanya Oluştur]  → magic /tr/bayi-kampanya?t=... (mevcut sayfa)

6. İlk kampanya oluşturuldu / atlandı
   /api/bayi-kampanya/save → advanceDiscovery("kampanya_olustu"):
   "🎉 Hazırsınız! İşte yapabilecekleriniz:
    📊 Web panelden tüm bayi ağınızı yönetin
    📈 Sabah brifinginiz ile günlük durumu takip edin
    👥 Çalışan davet ederek ekip kurun"
   [🖥 Web Panel] [👥 Çalışan Davet] [📋 Ana Menü]
```

### B.3 State machine — `bayi_discovery_step`

`emlak`'ın `discovery_step`'i tek SaaS varsayımı yapmış (`metadata.discovery_step`). Multi-tenant için daha temiz: namespace'le.

```ts
// metadata.bayi_discovery_step: 0..6
// veya genel:
metadata.discovery_steps = { bayi: 3, emlak: 4 }
```

**Tavsiye:** namespace'li struct, ileride emlak'ı da migrate ederiz.

`discovery-chain.ts`'i jenerik yap:
```ts
// platform/whatsapp/discovery-chain.ts
const STEP_TRIGGERS_BY_TENANT: Record<string, Record<string, number>> = {
  emlak: { mulk_eklendi: 1, sunum_hazir: 2, tarama_kuruldu: 3, portfoy_tanitildi: 4 },
  bayi:  { firma_kaydedildi: 1, urun_eklendi: 2, bayi_eklendi: 3, siparis_olustu: 4, kampanya_olustu: 5 },
};

advanceDiscovery(userId, tenantKey, phone, eventName)
```

Mevcut `advanceDiscovery(userId, phone, eventName)` çağrı yerleri ufak refactor: tenantKey ekle.

### B.4 Yeni / mevcut bileşenler

**Yeni web sayfaları (3):**

| Sayfa | Yol | Amaç | Form alanları |
|---|---|---|---|
| Firma Profili | `/tr/bayi-firma-profil?t=...` | Owner detaylı bilgi | (B.5) |
| Ürün Ekle | `/tr/bayi-urun-ekle?t=...` | Katalog girişi (foto, fiyat, stok) | (B.6) |
| Bayi Ekle | `/tr/bayi-ekle?t=...` | Manuel bayi kaydı (davet kullanmadan) | (B.7) |

**Yeni API endpoint'leri (3):**
- `POST /api/bayi-firma-profil/save` — `after()` chain devam
- `POST /api/bayi-urun-ekle/save` — `after()` + advanceDiscovery
- `POST /api/bayi-ekle/save` — `after()` + advanceDiscovery

**Mevcut yeniden kullanım:**
- `/bayidavet` (WA, çoklu kullanımlık dealer kod üretiyor) — Step 3 alternatif
- `/siparisolustur` (WA, 5-adım flow) — Step 4 trigger
- `/tr/bayi-kampanya` (web sayfa, mevcut) — Step 5 trigger
- `/tr/bayi-siparis`, `/bayi-fatura`, `/bayi-odeme` — chain dışı, ileride owner kullansın
- `discovery-chain.ts` — generic'leştir (B.3)
- `intro.ts` — `INTRO_TENANTS.add('bayi')` veya **bayi için ayrı `startBayiIntro` daha açık**: emlak intro sahibinden-DB'den demo veri gösteriyor; bayi'nin böyle bir veri tabanı yok. Bayi için intro = sadece **yetenek tanıtım metni + onboarding tetikle**.

**DB değişiklikleri:**
- Yeni tablo **gerek yok**.
- Mevcut: `bayi_products` (mevcut, ürün kataloğu), `bayi_dealers` (mevcut, dealer kayıtları).
- `profiles.metadata.discovery_steps` jsonb field — schema değişimi yok (metadata zaten jsonb).
- Owner bilgilerini `profiles.metadata.firma_profili` jsonb sub-object'inde tut: `vergi_no, iban, ofis_adresi, ofis_telefon, web_sitesi, sektor (zaten onboarding'de), logo_url, kuruluş_yili, vb.` — schema değişimi yok.

### B.5 İlk profil tamamlama formu — alanlar

`/tr/bayi-firma-profil?t=...` (emlak `profil-duzenle` paraleli):

```
🏢 Firma Bilgileri
─────────────────
* Ticari Unvan         (text)            — onboarding'den ön-doldurulu (company_name)
* Yetkili Adı Soyadı   (text)            — display_name'e yazılır
  Pozisyon              (text)            — örn: "Genel Müdür"
* Vergi Dairesi         (text)            — örn: "Bodrum VD"
* Vergi No / TCKN       (text, 10-11 dgt)
* Sektör                (select)          — boya/inşaat/elektrik/tesisat/hırdavat/klima/mobilya/gıda/diğer
  Kuruluş Yılı          (number)          — opsiyonel

📍 İletişim
─────────────────
* Ofis Telefonu         (tel)             — ülke kodu + numara
* Ofis Adresi           (textarea)        — il/ilçe/cadde
* E-posta               (email)
  Web Sitesi            (url)             — opsiyonel

💳 Finans (faturalandırma + tahsilat için)
─────────────────
  IBAN                  (text, TR + 24 dgt)  — opsiyonel ama şiddetle tavsiye
  Banka Adı             (text)            — opsiyonel
  Hesap Sahibi          (text, default = ticari unvan)

🎨 Marka (sunum + bayi web panel için)
─────────────────
  Logo                  (file upload, png/jpg/svg)  — opsiyonel
  Marka Rengi           (color picker)              — opsiyonel
  Kısa Tanıtım          (textarea, max 500c)        — bayilere gösterilen "hakkımızda"

[KAYDET]
```

Kayıt:
- `profiles.display_name` = yetkili adı
- `profiles.metadata.firma_profili = { vergi_dairesi, vergi_no, ofis_telefon, ofis_adresi, email_kurumsal, web_sitesi, iban, banka, hesap_sahibi, sektor, kuruluş_yili, logo_url, marka_rengi, tanitim }`
- `profiles.metadata.firma_profili_completed = true`
- Logo: `Storage bucket('bayi-logos')` → URL metadata'ya
- after() → ürün ekle linki

### B.6 Ürün ekle web formu (alanlar)

`/tr/bayi-urun-ekle?t=...`:

```
📦 Ürün Bilgisi
─────────────────
* Ürün Adı              (text)
* Ürün Kodu / SKU       (text)            — auto-suggest: ad'dan slug
* Kategori              (select+create)   — boya, vernik, fayans, ...
* Birim                 (select)          — adet, kg, lt, m², m, kutu, koli, palet
* Birim Fiyat           (number, KDV hariç)
* KDV %                 (select)          — 0 / 1 / 8 / 18 / 20
  Min. Sipariş Adedi    (number)          — opsiyonel
  Stok Miktarı          (number)          — opsiyonel (depocular sonra günceller)
  Açıklama              (textarea, max 1000c)

📷 Fotoğraflar
─────────────────
  Ana Görsel             (file)
  Ek Görseller (max 4)   (file[])

🏷 Bayi Erişimi
─────────────────
  ☐ Tüm bayiler bu ürünü görsün
  ☐ Bu ürün stok-bazlı (kalmazsa "tükendi" göster)

[KAYDET]
```

Kayıt: `bayi_products` insert + (kullanılırsa) `bayi-products` storage bucket fotolar.

### B.7 Bayi ekle web formu (manuel — davet linki kullanmayan akış)

`/tr/bayi-ekle?t=...`:

```
🏪 Bayi Bilgileri
─────────────────
* Firma Adı             (text)
* Yetkili Adı           (text)
* Yetkili Telefon       (tel — bu numara WA bot'u kullanacak)
  E-posta                (email)
  Vergi No                (text)
  Şehir / İlçe            (text)
  Ürün Grupları          (multi-select, mevcut donboard:products listesi)

[KAYDET ve Davet Et]
```

Kayıt:
- `bayi_dealers` insert
- (Opsiyonel) WA davet mesajı göndermek istersen owner'a sor: "Bu bayiye otomatik davet kodu gönderelim mi?"
- Evet → `bayi_invite_links` oluştur (max_uses=1, kişiye özel) ve telefonuna "Hoş geldin BAYI:CODE" mesajı

> **Tradeoff:** Bu form `/bayidavet` çoklu kullanım koduna alternatif. Owner zaten `/bayidavet` ile bir kod alabiliyor ve bayilere kendi yöntemiyle gönderiyor. Manuel form, owner'ın bayinin bilgilerini önceden bildiği durum için (ve dealer onboarding'i kendi başına yapmak yerine atlatma).

### B.8 Magic link TTL ve idempotency

- **TTL: 7 gün** (emlak `ara` örneği). Bayi sahibi sabah brifing'de gelen linki gece açabilir.
- **Idempotency:** `magic_link_tokens.used_at` set ediliyor — tek kullanım. Form save sonrası token invalidate.
- **Eski mesaj tekrarlandığında:** "Bu link zaten kullanılmış" mesajı (mevcut handler).
- **Discovery step idempotent:** `advanceDiscovery` zaten `targetStep !== currentStep + 1` ise döner. Aynı event 2 kez tetiklense de chain spam etmez.

---

## C) Açık sorular / tradeoff'lar

1. **Intro'yu bayi için aktive etmek vs etmemek.** Emlak'ın intro'su sahibinden-DB'den canlı veri gösteriyor → "aha an". Bayi'de böyle bir public-data yok (her bayi'nin verisi kendine özel). Önerim: bayi'de intro'yu **kısa yetenek metni + tek "🚀 Devam Et" butonu** olarak tut, demo arama yok. Yani `intro.ts`'i bayi'de bypass et, doğrudan onboarding başlat. **Soru:** kullanıcı bunu kabul mü, yoksa bayi'ye özgü bir demo (örn: "Sektörünüzde örnek bir sipariş simülasyonu") yapmak ister mi?

2. **Akış sırası: Firma profili önce mi, ürün önce mi?** Önerimde firma profili 1. adım. Avantajı: vergi no/IBAN olmadan fatura/sözleşme kesilemez. Dezavantaj: 8-12 alan büyük form, ilk dakikada yoruyor. Alternatif: profil sonraya bırakılır, kullanıcı önce ürün ekler → ilk fatura kesileceği zaman "vergi no eksik" uyarısıyla profil tamamlama tetiklenir. **Tavsiyem: profil önce + alanların yarısı opsiyonel** (vergi no, IBAN, logo opsiyonel — kritik olanlar: ofis_adresi, telefon, email).

3. **Logo upload — gerekli mi?** Olsa marka kimliği kuvvetlenir (sunumlarda, bayi web panel header'ında). Ama 2026-04 itibariyle bayi'nin sunum/web sayfa özelliği yok (emlak'ta var). **Tavsiyem: logo alanı opsiyonel + Faz 2'de gerçek kullanım yeri eklenince zorunlu yap.**

4. **Bayi ağı önce mi, ürün önce mi (step 2 vs 3)?** Ürün önce (önerim) çünkü bayiye gönderilecek katalog olmadan bayi sisteme katılınca ne yapacak? Ama bazı sektörlerde (büyük dağıtım) bayilerin önce kayıt olması mantıklı. **Tavsiyem: ürün önce — ilk ürün eklendiğinde "kataloğunuz hazır, şimdi bayilerinize gönderelim" doğal akış.**

5. **`siparisolustur` step 4 — owner kendisi sipariş veremez ki**, müşteri (dealer) verir. Owner için `siparisolustur` mantığı: "bayinizden gelen siparişi sisteme manuel kayıt etme" (örn: telefon siparişi). Şu anki kod ne yapıyor? **Doğrula:** `/siparisolustur` ctx.role'e göre dallanıyor mu? Owner için siparis ekleyip dealer'ı seç akışı var mı? Yoksa sadece dealer'ın `/siparisver` komutu mu çalışıyor? Bu chain step'i güvenli olması için **owner için yapay 5-adım sipariş simülasyonu** veya **demoyu atla, direkt step 5'e geç** seçeneği gerekli.

6. **Step 6 sonrası ne?** Emlak'ta chain step 4'te bitiyor ("ipucu yaz"). Bayi'de step 6'da kapatıyorum: 3 button (Web Panel, Çalışan Davet, Ana Menü). Alternatif: chain'e step 7 = "Çalışan Davet" eklemek. **Tradeoff:** Çalışan davet onboarding'in kritik parçası ama 6 step zaten uzun. Kullanıcı yorulduysa step 6'da "ipucu yaz" mantığıyla bitir, çalışan davet'i tip mesajıyla 24h sonra hatırlat. **Tavsiyem: step 6'da bitir, çalışan davet ipucu olarak gönderilsin.**

7. **Bayi dealer'ları için ayrı discovery chain?** Yeni dealer kayıt olduğunda `dealer-onboarding` 7 adım işliyor, sonrası ne? Kataloğa bakıp ilk siparişini vermesi lazım. **Önerim:** dealer için kısa 3 adımlı chain — `urun-katalog-gor → siparis-ver → bakiye-kontrol`. Bu **bayi-discovery-chain'in dealer varyasyonu** olarak ayrı bir B.3 state machine entry'si: `STEP_TRIGGERS_BY_TENANT.bayi_dealer = {...}`. Ama Faz 1 dışında — kullanıcı kararı.

8. **`bayi-firma-profil` mi, `bayi-profil` mi?** Emlak'ta `/profil-duzenle` (kişisel danışman profili). Bayi'de profil = firma. İsim simetrisi için `/bayi-profil` daha temiz. **Tavsiyem: route ismi `/tr/bayi-profil?t=...`.**

9. **Foto upload edge case (mobil WA WebView 5+)** — emlak'ta yaşandı (commit 8313e3c). Yeni `bayi-urun-ekle` formu en fazla 5 foto desteklesin (zaten yukarıda 1+4=5 yazdım), 5+ için web-only mesajı.

---

## D) Özet — onay bekleyenler

1. **A.3 fix**: `defaultCapabilitiesForRole` helper + 4 INSERT site update. ✅/❌
2. **A.4 hotfix UPDATE** (Ab dağıtım kullanıcısı). ✅/❌
3. **A.4 backfill** (boş-cap diğer admin'ler varsa). ✅/❌
4. **B.2 chain** (6 adım sıra) — sıra kabul mü, değişiklik var mı? ✅/❌
5. **B.3 generic discovery-chain refactor** (tenant-aware) — bu yapılırsa emlak da aynı zamanda biraz refactor olur. ✅/❌
6. **B.4 yeni 3 web sayfa + 3 API** — kapsam kabul? ✅/❌
7. **B.5 firma profili form alanları** — eksik/fazla var mı? ✅/❌
8. **C.1 bayi'de intro'yu kısalt (demo arama yok)** ✅/❌
9. **C.5 step 4 sipariş simülasyonu** — owner için sipariş ekleme akışı tasarımı netleştirilmeli mi (ayrı task)?
10. **C.7 dealer chain** — Faz 2'ye bırakalım mı?
