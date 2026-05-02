# Bayi Intro Tasarımı — UPU First-Person (2026-04-28)

> Önceki turdaki anlatım yanlıştı. Bu doküman `intro.ts`'in **bugünkü kodunu** baz alıp bayi'ye uyarlıyor.

## 1) Emlak intro'sunun GERÇEK akışı (kod gerçeği)

`src/platform/whatsapp/intro.ts:58-111` `startIntro(ctx)`:

1. `INTRO_TENANTS.has("emlak")` check (sadece emlak)
2. **Tek mesaj** — UPU first-person: `"👋 Merhaba! Ben UPU, sizin kişisel AI asistanınızım..."` + 4 madde "yapabileceklerim"
3. `profiles.metadata.onboarding_completed=true, discovery_step=0` set — **onboarding form ATLANIYOR**, kullanıcı `/profilim`'den sonra doldurur
4. Magic link `/tr/ara?t=...` "🔍 Hızlı Arama" butonuyla gönderiliyor (7 gün TTL)
5. Return true

Sonrası chain dışında akış:
- Kullanıcı /tr/ara'da arama yapar → `/api/ara/save` `after()` içinde `/tr/takip` magic link gönderir
- Kullanıcı /tr/takip kaydeder → `/api/takip/save` `advanceDiscovery("tarama_kuruldu")` (chain step 3)
- Kullanıcı menüden mülk ekleyince chain step 1 başlar (`mulk_eklendi`)

**Önemli not:** `handleIntroCallback`'in `vf:region/type/listing/listed` adımları **kullanılmayan eski kod** — `startIntro` artık callback chain'i değil, magic link gönderiyor. Sadece `vf:start` adımı (eski "Devam Et" sonrası onboarding başlat) hala var ama mevcut `startIntro` onu da çağırmıyor (kullanıcı `vf:start`'a tıklayacak yere düşmüyor). Yani `handleIntroCallback` neredeyse tümüyle dead code; ileride temizlenebilir.

## 2) Bayi farkı

- Emlak'ta public sahibinden verisi var — value-first demo yapılabiliyor (canlı bölge istatistikleri).
- Bayi'de B2B veri her firmaya özel — public yok. Demo arama yapamayız.
- Aha-an, kullanıcının **kendi verisini sisteme ekleyince** doğal olarak gelir (firma profili → ürün → bayi davet).

**Sonuç:** Bayi intro = UPU mesajı + "Şimdi sizi tanıyayım" → onboarding (3 adım) → discovery chain (5 adım).

## 3) Bayi intro mesajı — taslak

```
👋 Merhaba! Ben UPU, sizin sanal bayi yönetim asistanınızım. 7/24 bayi ağınızı, siparişlerinizi ve tahsilatınızı takip edeceğim.

*Yapabileceklerimden bazıları:*

• Her sabah size günün özet brifingini göndereceğim — bekleyen siparişler, kritik stok seviyeleri, vadesi yaklaşan ödemeler ve teslimat planı tek mesajda.
• Bayilerinizden telefonla gelen siparişleri WhatsApp'tan tek tıkla sisteme kaydederim — sipariş anında kayıtlı, fatura/sevk için hazır.
• Vadesi yaklaşan tahsilatları sizden önce görür, ilgili bayiye otomatik hatırlatma için onayınızı isterim.
• Tüm bayilerinize tek tıkla kampanya duyurusu gönderirim — yeni indirim, kısıtlı teklif, ürün lansmanı.
• Stok kritik seviyeye düştüğünde uyarır, tedarikçiye sipariş önerisi sunarım.
```

5 madde, first-person, "ben/edeceğim" tonu — emlak'la simetrik. Kullanıcının sıraladığı 5 yetenekle birebir eşleşiyor.

## 4) Flow şeması

```
SIGNUP (BAYI:CODE veya invite_link)
   ↓ [route.ts → startIntro(ctx)]
   ↓
1) UPU mesajı (5 madde)         ← intro.ts startIntro bayi branch
2) "Şimdi sizi tanıyayım! 👇"
   [🚀 Başlayalım] button (id="vf:start")
   ↓ kullanıcı tıklar
   ↓ [router.ts vf: prefix → handleIntroCallback]
3) vf:start → onboarding başlar (mevcut handler değişmiyor)
   ↓
4) Onboarding 3 adım: company_name → dealer_count → briefing
   ↓ [bayi/onboarding-flow.ts onFinish]
5) startBayiDiscoveryChain (mevcut)
   ↓ Magic link → /tr/bayi-profil
   ↓
6) Firma profili formu (5 zorunlu) → /api/bayi-profil/save
   ↓ advanceDiscovery("firma_kaydedildi")
7) Step 1 prompt → /tr/bayi-urun-ekle magic link
   ↓ ... (mevcut 5-adım chain)
```

## 5) Kod değişiklikleri (minimum)

### 5.1 `src/platform/whatsapp/intro.ts`

**a) INTRO_TENANTS:**
```ts
const INTRO_TENANTS = new Set(["emlak", "bayi"]);
```

**b) startIntro içinde tenant branch:**
```ts
export async function startIntro(ctx: WaContext): Promise<boolean> {
  if (!INTRO_TENANTS.has(ctx.tenantKey)) return false;

  if (ctx.tenantKey === "bayi") {
    return await startBayiIntro(ctx);
  }

  // emlak — mevcut akış değişmiyor
  ...
}

async function startBayiIntro(ctx: WaContext): Promise<boolean> {
  const introMsg =
    `👋 Merhaba! Ben UPU, sizin sanal bayi yönetim asistanınızım. 7/24 bayi ağınızı, siparişlerinizi ve tahsilatınızı takip edeceğim.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah size günün özet brifingini göndereceğim — bekleyen siparişler, kritik stok seviyeleri, vadesi yaklaşan ödemeler ve teslimat planı tek mesajda.\n` +
    `• Bayilerinizden telefonla gelen siparişleri WhatsApp'tan tek tıkla sisteme kaydederim — sipariş anında kayıtlı, fatura/sevk için hazır.\n` +
    `• Vadesi yaklaşan tahsilatları sizden önce görür, ilgili bayiye otomatik hatırlatma için onayınızı isterim.\n` +
    `• Tüm bayilerinize tek tıkla kampanya duyurusu gönderirim — yeni indirim, kısıtlı teklif, ürün lansmanı.\n` +
    `• Stok kritik seviyeye düştüğünde uyarır, tedarikçiye sipariş önerisi sunarım.`;

  await sendText(ctx.phone, introMsg);

  await sendButtons(ctx.phone, "Şimdi sizi tanıyayım! 👇",
    [{ id: "vf:start", title: "🚀 Başlayalım" }],
    { skipNav: true },
  );

  return true;
}
```

**c) `handleIntroCallback`'te değişiklik YOK** — `vf:start` zaten `getOnboardingFlow(ctx.tenantKey)` ile tenant-agnostic. Bayi için de doğru çalışır (`bayiOnboardingFlow` mevcut).

### 5.2 `src/app/api/whatsapp/route.ts` — değişiklik YOK

Mevcut: `const introStarted = dealerRole === "dealer" ? false : await startIntro(onbCtx);` — admin/employee bayi için intro çalışacak (`startIntro` true dönecek), `if (!introStarted)` branch'i atlanacak. Dealer için intro skip ediliyor (dealer-onboarding 7 adım kendi yolunda).

Universal invite flow (line 442): `await startIntro(onbCtx)` — bayi için de çalışacak.

### 5.3 `src/tenants/bayi/onboarding-flow.ts` — değişiklik YOK

`onFinish` zaten `startBayiDiscoveryChain` çağırıyor — chain doğru tetiklenir.

### 5.4 Toplam: ~30 satır değişiklik, 1 dosya (`intro.ts`)

## 6) Önemli karşılaştırma — emlak vs bayi intro

| | Emlak | Bayi (öneri) |
|---|---|---|
| UPU first-person mesaj | ✅ 4 madde | ✅ 5 madde |
| `metadata.onboarding_completed` set | ✅ true (intro'da) | ❌ false (onboarding gerekli) |
| Value-first demo | ✅ Canlı sahibinden verisi | ❌ Public veri yok |
| Sonraki adım | Magic link `/tr/ara` | Buton "🚀 Başlayalım" → onboarding |
| Onboarding form | Atlanıyor (sonra `/profilim`) | 3 adım zorunlu |
| Chain başlangıcı | Kullanıcı menüden ilk mülk eklediğinde | Onboarding bitince otomatik |

Bayi'de onboarding 3 adımlık (firma_adı + bayi_sayısı + briefing) — kısa, atlanmasına gerek yok. Briefing opsiyonu kritik (sabah brifingi UPU'nun ilk söz verdiği şey, ayar burada alınmalı).

## 7) Açık sorular / tradeoff'lar

1. **Onboarding atlamak mı, korumak mı?** Korumayı seçtim — briefing tercihi için. Alternatif: emlak gibi atla, briefing'i sonra ayarlat. **Tradeoff:** atlama daha hızlı (intro→profil tek akış) ama "her sabah size brifing göndereceğim" diyen UPU mesajının ardından kullanıcının briefing tercihini sormamak tutarsız. **Tavsiyem: koru.**

2. **Mesaj uzunluğu (5 madde) WA'da nasıl görünecek?** Tahmini ~600 karakter — sendText sınırı 4096, problem değil. Mobilde sığar.

3. **`vf:start` butonu vs onboarding doğrudan tetikleme.** Buton koymadan UPU mesajı sonrası onboarding'i hemen tetikleyebiliriz (iki ayrı mesaj). Avantajı: 1 tıklama az. Dezavantajı: kullanıcı UPU mesajını okumadan onboarding sorusuyla karşılaşırsa şaşırır. **Tavsiyem: buton koru** (emlak intro'sunun "Devam Et"i gibi — niyet-belirtme).

4. **Mesaj tonu — "edeceğim/yapacağım" mı, "yaparım" mı?** Türkçe satış yazılarında "edeceğim" gelecek vaadi (henüz yapılmadı), "yaparım" şimdiki yetenek. UPU yeni başladı — ikisi de işler. Emlak metni karışık ("hazırlarım", "gönderirim", "indiririm"). **Tavsiyem: simetri için aynı karışım** (taslakta uyguladım: "edeceğim, kaydederim, görür, gönderirim, uyarır").

5. **Briefing iletişimi UPU mesajıyla onboarding sorusu arasında çakışıyor mu?** Mesajda "her sabah brifing göndereceğim" diyoruz; sonra onboarding'de "brifing göndereyim mi?" diye soruyoruz. Hafif tutarsızlık. **Çözüm:** UPU mesajını "her sabah dilerseniz size özet brifing gönderebilirim" olarak yumuşat (vaat değil yetenek). Onboarding sorusu "evet/hayır" olarak kalsın.

6. **Dead-code temizliği** — `handleIntroCallback`'in `vf:region/type/listing/listed` dalları artık tetiklenmiyor (startIntro magic link kullanıyor). Bu PR'ın kapsamı dışı; ayrı bir cleanup commit'inde silinebilir.

## 8) Onay

Aşağıdakileri onaylarsan implementasyona geçiyorum:

1. ✅/❌ INTRO_TENANTS'a "bayi" ekle, intro.ts'de bayi branch (~30 satır)
2. ✅/❌ Mesaj taslağı (§3) — değiştirilmesi gereken cümle var mı?
3. ✅/❌ Onboarding korunacak (briefing için), atlanmayacak
4. ✅/❌ "🚀 Başlayalım" butonu UPU mesajının ardından (vs. doğrudan onboarding tetikle)
5. ✅/❌ §7.5 yumuşatma uygulansın (mesajda "dilerseniz")
6. ⏸ `handleIntroCallback` dead-code temizliği — bu PR'a dahil mi, ayrı mı?
