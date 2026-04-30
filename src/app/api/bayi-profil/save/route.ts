/**
 * POST /api/bayi-profil/save — save firma profili (zorunlu 7 + opsiyonel +
 * country-aware vergi alanları + adapter seçimi) to profiles.metadata.
 *
 * Tek-form akış: WA onboarding'in yerine geçer. Save sonrası:
 *   - onboarding_completed = true
 *   - firma_profili_completed = true
 *   - tenant_locale_settings (country, currency, locale) profile.metadata'da
 *   - enabled_adapters (accounting, payment, shipping, einvoice) metadata'da
 *   - advanceDiscovery step 1 (firma_kaydedildi) tetiklenir → bir sonraki
 *     magic link (ürün ekle) WA'ya düşer.
 *
 * Multi-country validasyon:
 *   - country=NL: KvK 8 hane (opsiyonel), BTW NL...B01 format (opsiyonel),
 *     IBAN NL18 hane (opsiyonel ama format kontrol edilir)
 *   - country=TR: Vergi No 10/11 hane (opsiyonel), IBAN TR26 hane (opsiyonel)
 *   - country=BE/DE: minimal validasyon (BTW number opsiyonel)
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REQUIRED = [
  "ticari_unvan", "yetkili_adi", "ofis_telefon", "ofis_adresi", "sektor",
  "bayi_sayisi", "brifing_enabled",
] as const;

const SEKTOR_VALUES = new Set([
  "boya", "insaat", "elektrik", "tesisat", "hirdavat",
  "klima", "mobilya", "gida", "horeca", "helal_et", "kuruyemis",
  "baharat", "icecek", "kozmetik", "otomotiv", "tekstil",
  "endustriyel", "tarim", "diger",
]);

const BAYI_SAYISI_VALUES = new Set(["1-10", "11-50", "50+"]);
const BRIFING_VALUES = new Set(["evet", "hayir"]);
const COUNTRY_VALUES = new Set(["NL", "TR", "BE", "DE"]);
const CURRENCY_VALUES = new Set(["EUR", "TRY", "USD", "GBP"]);
const LOCALE_VALUES = new Set(["tr-NL", "tr-TR", "nl-NL", "en-US", "en-GB"]);

const ACCOUNTING_VALUES = new Set(["yuki", "exact", "snelstart", "logo_nl", "mikro", "other", "none", ""]);
const PAYMENT_VALUES = new Set(["mollie", "stripe", "iyzico", "manual", "none", ""]);
const SHIPPING_VALUES = new Set(["postnl", "dhl", "yurtici", "mng", "own_fleet", "other", ""]);
const EINVOICE_VALUES = new Set(["storecove", "none", ""]);

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Country-aware soft validation. Boş alanlar kabul (zorunlu değil).
 * Format yanlışsa hata döner; sadece optional opsiyonel alanlar için.
 */
function validateCountryFields(country: string, body: Record<string, unknown>): string | null {
  const ibanRaw = s(body.iban).replace(/\s+/g, "").toUpperCase();
  const vergiNo = s(body.vergi_no).toUpperCase();
  const kvkNo = s(body.kvk_no).replace(/\D/g, "");

  if (country === "NL") {
    if (kvkNo && kvkNo.length !== 8) {
      return "KvK numarası 8 hane olmalı.";
    }
    if (vergiNo && !/^NL\d{9}B\d{2}$/.test(vergiNo)) {
      return "BTW number formatı: NL123456789B01";
    }
    if (ibanRaw && !/^NL\d{2}[A-Z]{4}\d{10}$/.test(ibanRaw)) {
      return "IBAN-NL formatı: NL00 ABCD 0123 4567 89";
    }
  } else if (country === "TR") {
    if (vergiNo && !/^\d{10,11}$/.test(vergiNo)) {
      return "Vergi No / TCKN 10 veya 11 hane olmalı.";
    }
    if (ibanRaw && !/^TR\d{24}$/.test(ibanRaw)) {
      return "IBAN-TR formatı: TR + 24 hane.";
    }
  }
  // BE/DE: ileride genişletilir; şimdilik format check yok.
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = s(body.token);
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    // Required field validation
    for (const k of REQUIRED) {
      if (!s(body[k])) return NextResponse.json({ error: `Zorunlu alan eksik: ${k}` }, { status: 400 });
    }
    const ticariUnvan = s(body.ticari_unvan);
    const yetkiliAdi = s(body.yetkili_adi);
    const ofisTelefon = s(body.ofis_telefon);
    const ofisAdresi = s(body.ofis_adresi);
    const sektor = s(body.sektor);

    if (ticariUnvan.length < 2) return NextResponse.json({ error: "Ticari unvan en az 2 karakter olmalı." }, { status: 400 });
    if (yetkiliAdi.length < 2) return NextResponse.json({ error: "Yetkili adı en az 2 karakter olmalı." }, { status: 400 });
    if (ofisTelefon.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Geçerli telefon girin (en az 9 hane)." }, { status: 400 });
    }
    if (!SEKTOR_VALUES.has(sektor)) {
      return NextResponse.json({ error: "Geçerli sektör seçin." }, { status: 400 });
    }

    const bayiSayisi = s(body.bayi_sayisi);
    if (!BAYI_SAYISI_VALUES.has(bayiSayisi)) {
      return NextResponse.json({ error: "Geçerli bayi sayısı seçin." }, { status: 400 });
    }
    const brifingEnabled = s(body.brifing_enabled);
    if (!BRIFING_VALUES.has(brifingEnabled)) {
      return NextResponse.json({ error: "Brifing tercihi seçin." }, { status: 400 });
    }

    // Lokalizasyon — opsiyonel ama enum doğrulaması yapılır.
    const country = s(body.country) || "NL";
    const currency = s(body.currency) || "EUR";
    const locale = s(body.locale) || "tr-NL";
    if (!COUNTRY_VALUES.has(country)) return NextResponse.json({ error: "Geçersiz ülke." }, { status: 400 });
    if (!CURRENCY_VALUES.has(currency)) return NextResponse.json({ error: "Geçersiz para birimi." }, { status: 400 });
    if (!LOCALE_VALUES.has(locale)) return NextResponse.json({ error: "Geçersiz dil." }, { status: 400 });

    // Adapter seçimi — opsiyonel, enum doğrulaması.
    const accounting = s(body.accounting);
    const payment = s(body.payment);
    const shipping = s(body.shipping);
    const einvoice = s(body.einvoice) || "none";
    if (!ACCOUNTING_VALUES.has(accounting)) return NextResponse.json({ error: "Geçersiz muhasebe yazılımı." }, { status: 400 });
    if (!PAYMENT_VALUES.has(payment)) return NextResponse.json({ error: "Geçersiz ödeme servisi." }, { status: 400 });
    if (!SHIPPING_VALUES.has(shipping)) return NextResponse.json({ error: "Geçersiz kargo servisi." }, { status: 400 });
    if (!EINVOICE_VALUES.has(einvoice)) return NextResponse.json({ error: "Geçersiz e-fatura servisi." }, { status: 400 });

    // Country-aware format validasyonu (opsiyonel alanlar için)
    const countryErr = validateCountryFields(country, body);
    if (countryErr) return NextResponse.json({ error: countryErr }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, whatsapp_phone, metadata")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const existingMeta = (profile.metadata || {}) as Record<string, unknown>;
    const firmaProfili = {
      country,
      ticari_unvan: ticariUnvan,
      yetkili_adi: yetkiliAdi,
      ofis_telefon: ofisTelefon,
      ofis_adresi: ofisAdresi,
      sektor,
      bayi_sayisi: bayiSayisi,
      brifing_enabled: brifingEnabled,
      vergi_dairesi: s(body.vergi_dairesi) || null,
      vergi_no: s(body.vergi_no) || null,
      kvk_no: s(body.kvk_no) || null,
      kurulus_yili: s(body.kurulus_yili) || null,
      email_kurumsal: s(body.email_kurumsal) || null,
      web_sitesi: s(body.web_sitesi) || null,
      iban: s(body.iban).replace(/\s+/g, "") || null,
      banka: s(body.banka) || null,
      hesap_sahibi: s(body.hesap_sahibi) || null,
      tanitim: s(body.tanitim) || null,
      completed_at: new Date().toISOString(),
    };

    // Tek-form akış: bu form WA onboarding'in yerine geçtiği için
    // onboarding_completed bayrağını da burada set ediyoruz. Eski
    // metadata.company_name / dealer_count / briefing_enabled alanlarını
    // da geriye uyumluluk için dolduruyoruz (router/cron eski alanları
    // okuyabilir).
    const existingSteps = (existingMeta.discovery_steps || {}) as Record<string, number>;
    const newMeta: Record<string, unknown> = {
      ...existingMeta,
      firma_profili: firmaProfili,
      firma_profili_completed: true,
      onboarding_completed: true,
      company_name: ticariUnvan,
      dealer_count: bayiSayisi,
      briefing_enabled: brifingEnabled === "evet",
      // Lokalizasyon — runtime'da formatCurrency/formatDate per-user override
      // gerekiyorsa buradan okur. Yoksa tenant default uygulanır.
      tenant_locale: { country, currency, locale },
      // Adapter seçimi — runtime'da adapters/index.ts resolver buradan
      // tenant_id + adapter_key okuyup ilgili modülü çağırır.
      enabled_adapters: { accounting, payment, shipping, einvoice },
      // Tier (Aşama 6): yeni profil "starter" tier'ında başlar; Stripe
      // billing entegrasyonu sonrası upgrade akışında metadata.tier
      // değişir. Mevcut tier varsa korunur.
      tier: (existingMeta.tier as string) || "starter",
      discovery_steps: { ...existingSteps, bayi: existingSteps.bayi ?? 0 },
    };

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        metadata: newMeta,
        display_name: yetkiliAdi,
      })
      .eq("id", profile.id);

    if (updErr) {
      console.error("[bayi-profil:save]", updErr);
      return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    const userId = profile.id;
    const userPhone = profile.whatsapp_phone as string | undefined;

    after(async () => {
      try {
        if (!userPhone) return;
        const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
        await advanceDiscovery(userId, "bayi", userPhone, "firma_kaydedildi");
      } catch (err) {
        console.error("[bayi-profil:save] WA chain failed:", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bayi-profil:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
