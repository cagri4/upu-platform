"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";
type Country = "NL" | "TR" | "BE" | "DE";
type Currency = "EUR" | "TRY" | "USD" | "GBP";
type Locale = "tr-NL" | "tr-TR" | "nl-NL" | "en-US";

interface Firma {
  // Lokalizasyon
  country: Country;
  currency: Currency;
  locale: Locale;

  // Adapter seçimi (onboarding sonrası ayarlardan değiştirilebilir)
  accounting: string;     // yuki | exact | snelstart | logo_nl | mikro | other | none
  payment: string;        // mollie | stripe | iyzico | manual | none
  shipping: string;       // postnl | dhl | yurtici | mng | own_fleet | other
  einvoice: string;       // storecove | none

  // Zorunlu firma bilgileri
  ticari_unvan: string;
  yetkili_adi: string;
  ofis_telefon: string;
  ofis_adresi: string;
  sektor: string;
  bayi_sayisi: string;        // "1-10" | "11-50" | "50+"
  brifing_enabled: string;    // "evet" | "hayir"

  // Country-aware: Türkiye için Vergi No+Vergi Dairesi, NL için KvK+BTW
  vergi_dairesi: string;
  vergi_no: string;           // TR: 10/11 hane | NL: BTW (NL...B01)
  kvk_no: string;             // NL: 8 hane KvK
  kurulus_yili: string;
  email_kurumsal: string;
  web_sitesi: string;
  iban: string;               // TR: TR.. (24 hane) | NL: NL.. (16 hane)
  banka: string;
  hesap_sahibi: string;
  tanitim: string;
}

const SEKTORLER: Array<{ id: string; label: string }> = [
  { id: "boya", label: "Boya & Vernik" },
  { id: "insaat", label: "İnşaat Malzemesi" },
  { id: "elektrik", label: "Elektrik & Aydınlatma" },
  { id: "tesisat", label: "Tesisat & Sıhhi" },
  { id: "hirdavat", label: "Hırdavat" },
  { id: "klima", label: "Klima & Isıtma" },
  { id: "mobilya", label: "Mobilya" },
  { id: "gida", label: "Gıda Toptan" },
  { id: "horeca", label: "Horeca Tedarik" },
  { id: "helal_et", label: "Helal Et & Şarküteri" },
  { id: "kuruyemis", label: "Kuruyemiş & Kuru Gıda" },
  { id: "baharat", label: "Baharat & Sos" },
  { id: "icecek", label: "İçecek" },
  { id: "kozmetik", label: "Kozmetik" },
  { id: "otomotiv", label: "Otomotiv & Yedek Parça" },
  { id: "tekstil", label: "Tekstil" },
  { id: "endustriyel", label: "Endüstriyel Ürün & Kimyasal" },
  { id: "tarim", label: "Tarım Girdileri" },
  { id: "diger", label: "Diğer" },
];

const BAYI_SAYISI_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "1-10", label: "1-10 bayi" },
  { id: "11-50", label: "11-50 bayi" },
  { id: "50+", label: "50+ bayi" },
];

const COUNTRY_OPTIONS: Array<{ id: Country; label: string }> = [
  { id: "NL", label: "🇳🇱 Hollanda" },
  { id: "TR", label: "🇹🇷 Türkiye" },
  { id: "BE", label: "🇧🇪 Belçika" },
  { id: "DE", label: "🇩🇪 Almanya" },
];

const CURRENCY_OPTIONS: Array<{ id: Currency; label: string }> = [
  { id: "EUR", label: "€ EUR" },
  { id: "TRY", label: "₺ TRY" },
  { id: "USD", label: "$ USD" },
  { id: "GBP", label: "£ GBP" },
];

const LOCALE_OPTIONS: Array<{ id: Locale; label: string }> = [
  { id: "tr-NL", label: "🇹🇷 Türkçe (Hollanda)" },
  { id: "tr-TR", label: "🇹🇷 Türkçe (Türkiye)" },
  { id: "nl-NL", label: "🇳🇱 Nederlands" },
  { id: "en-US", label: "🇬🇧 English" },
];

const ACCOUNTING_OPTIONS: Array<{ id: string; label: string; country?: Country[] }> = [
  { id: "yuki", label: "Yuki", country: ["NL", "BE"] },
  { id: "exact", label: "Exact Online", country: ["NL", "BE"] },
  { id: "snelstart", label: "SnelStart", country: ["NL"] },
  { id: "logo_nl", label: "Logo (Türkiye)", country: ["TR"] },
  { id: "mikro", label: "Mikro", country: ["TR"] },
  { id: "other", label: "Diğer / Manuel" },
  { id: "none", label: "Henüz yok" },
];

const PAYMENT_OPTIONS: Array<{ id: string; label: string; country?: Country[] }> = [
  { id: "mollie", label: "Mollie (iDEAL/SEPA)", country: ["NL", "BE", "DE"] },
  { id: "stripe", label: "Stripe" },
  { id: "iyzico", label: "Iyzico", country: ["TR"] },
  { id: "manual", label: "Banka transferi (manuel)" },
  { id: "none", label: "Henüz yok" },
];

const SHIPPING_OPTIONS: Array<{ id: string; label: string; country?: Country[] }> = [
  { id: "postnl", label: "PostNL", country: ["NL"] },
  { id: "dhl", label: "DHL" },
  { id: "yurtici", label: "Yurtiçi Kargo", country: ["TR"] },
  { id: "mng", label: "MNG", country: ["TR"] },
  { id: "own_fleet", label: "Kendi araçlarım" },
  { id: "other", label: "Diğer" },
];

const EINVOICE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "storecove", label: "Storecove (Peppol)" },
  { id: "none", label: "Henüz yok" },
];

const empty: Firma = {
  country: "NL", currency: "EUR", locale: "tr-NL",
  accounting: "", payment: "", shipping: "", einvoice: "none",
  ticari_unvan: "", yetkili_adi: "", ofis_telefon: "", ofis_adresi: "", sektor: "",
  bayi_sayisi: "", brifing_enabled: "evet",
  vergi_dairesi: "", vergi_no: "", kvk_no: "", kurulus_yili: "",
  email_kurumsal: "", web_sitesi: "",
  iban: "", banka: "", hesap_sahibi: "", tanitim: "",
};

export default function BayiProfilPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [firma, setFirma] = useState<Firma>(empty);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-profil/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setFirma({ ...empty, ...d.firma });
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  function update(patch: Partial<Firma>) {
    setFirma(prev => ({ ...prev, ...patch }));
  }

  // Country değişince makul varsayılanları otomatik seç (kullanıcı override
  // edebilir). Telefon placeholder'ı, IBAN format'ı, vergi alan kümesi de
  // country'ye göre değişiyor.
  function changeCountry(c: Country) {
    const patch: Partial<Firma> = { country: c };
    if (c === "NL") { patch.currency = "EUR"; patch.locale = "tr-NL"; }
    if (c === "TR") { patch.currency = "TRY"; patch.locale = "tr-TR"; }
    if (c === "BE") { patch.currency = "EUR"; patch.locale = "tr-NL"; }
    if (c === "DE") { patch.currency = "EUR"; patch.locale = "tr-NL"; }
    update(patch);
  }

  const countryFiltered = useMemo(() => {
    const filterByCountry = <T extends { country?: Country[] }>(opts: T[]) =>
      opts.filter(o => !o.country || o.country.includes(firma.country));
    return {
      accounting: filterByCountry(ACCOUNTING_OPTIONS),
      payment: filterByCountry(PAYMENT_OPTIONS),
      shipping: filterByCountry(SHIPPING_OPTIONS),
    };
  }, [firma.country]);

  async function save() {
    setError("");
    if (!firma.ticari_unvan.trim() || firma.ticari_unvan.trim().length < 2) { setError("Ticari unvan girin."); return; }
    if (!firma.yetkili_adi.trim() || firma.yetkili_adi.trim().length < 2) { setError("Yetkili adı girin."); return; }
    if (firma.ofis_telefon.replace(/\D/g, "").length < 9) { setError("Geçerli telefon girin."); return; }
    if (!firma.ofis_adresi.trim()) { setError("Ofis adresi girin."); return; }
    if (!firma.sektor) { setError("Sektör seçin."); return; }
    if (!firma.bayi_sayisi) { setError("Bayi sayısı seçin."); return; }
    if (firma.brifing_enabled !== "evet" && firma.brifing_enabled !== "hayir") { setError("Brifing tercihi seçin."); return; }

    setStatus("saving");
    try {
      const res = await fetch(`/api/bayi-profil/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...firma }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;

  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div>
    <h1 className="text-xl font-bold mb-2">Profiliniz hazır!</h1>
    <p className="text-slate-600 text-sm mb-4">Sıradaki adım WhatsApp&apos;a düştü.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
  const isNL = firma.country === "NL" || firma.country === "BE" || firma.country === "DE";
  const phonePlaceholder = isNL ? "+31 6 12345678" : "0212 XXX XX XX";
  const ibanPlaceholder = isNL ? "NL00 ABCD 0123 4567 89" : "TR00 0000 0000 0000 0000 0000 00";
  const vergiNoPlaceholder = isNL ? "NL123456789B01 (BTW)" : "10 veya 11 hane";
  const vergiNoLabel = isNL ? "BTW Number" : "Vergi No / TCKN";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🏢</div>
          <h1 className="text-xl font-bold">Firma Profili</h1>
          <p className="text-emerald-100 text-sm mt-1">Zorunlu alanlar + ülke ve yazılım tercihleri. ~5 dakika.</p>
        </div>

        <Section title="🌐 Lokalizasyon">
          <Field label="Ülke">
            <select value={firma.country} onChange={e => changeCountry(e.target.value as Country)}
              className={inputCls}>
              {COUNTRY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Para Birimi">
            <select value={firma.currency} onChange={e => update({ currency: e.target.value as Currency })}
              className={inputCls}>
              {CURRENCY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Dil">
            <select value={firma.locale} onChange={e => update({ locale: e.target.value as Locale })}
              className={inputCls}>
              {LOCALE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="🔴 Zorunlu">
          <Field label="Ticari Unvan">
            <input value={firma.ticari_unvan} onChange={e => update({ ticari_unvan: e.target.value })}
              placeholder={isNL ? "ABC Distribution B.V." : "ABC Dağıtım Ltd."} className={inputCls} required />
          </Field>
          <Field label="Yetkili Adı Soyadı">
            <input value={firma.yetkili_adi} onChange={e => update({ yetkili_adi: e.target.value })}
              placeholder="Ahmet Yılmaz" className={inputCls} required />
          </Field>
          <Field label="Ofis Telefonu">
            <input type="tel" value={firma.ofis_telefon} onChange={e => update({ ofis_telefon: e.target.value })}
              placeholder={phonePlaceholder} className={inputCls} required />
          </Field>
          <Field label="Ofis Adresi">
            <textarea rows={2} value={firma.ofis_adresi} onChange={e => update({ ofis_adresi: e.target.value })}
              placeholder={isNL ? "Postcode, Straat, Plaats" : "İl, ilçe, mahalle, sokak"} className={inputCls} required />
          </Field>
          <Field label="Sektör">
            <select value={firma.sektor} onChange={e => update({ sektor: e.target.value })}
              className={inputCls} required>
              <option value="">Seçin...</option>
              {SEKTORLER.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Bayi Sayısı">
            <select value={firma.bayi_sayisi} onChange={e => update({ bayi_sayisi: e.target.value })}
              className={inputCls} required>
              <option value="">Seçin...</option>
              {BAYI_SAYISI_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Brifing — Sabah Günlük Özet">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="brifing" value="evet"
                  checked={firma.brifing_enabled === "evet"}
                  onChange={() => update({ brifing_enabled: "evet" })}
                  className="accent-emerald-600" />
                <span>Evet, gönder</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="brifing" value="hayir"
                  checked={firma.brifing_enabled === "hayir"}
                  onChange={() => update({ brifing_enabled: "hayir" })}
                  className="accent-emerald-600" />
                <span>Hayır</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Açık siparişler, kritik stok, vadesi gelen ödemeler özet.</p>
          </Field>
        </Section>

        <Section title="🔌 Yazılım Entegrasyonları">
          <p className="text-[11px] text-slate-500 -mt-1 mb-2">
            Şu an kullandığınız yazılımları seçin — sistemimiz onlarla otomatik konuşacak. Henüz yoksa &quot;Henüz yok&quot; seçin.
          </p>
          <Field label="Muhasebe Yazılımı">
            <select value={firma.accounting} onChange={e => update({ accounting: e.target.value })}
              className={inputCls}>
              <option value="">Seçin...</option>
              {countryFiltered.accounting.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Ödeme Servisi">
            <select value={firma.payment} onChange={e => update({ payment: e.target.value })}
              className={inputCls}>
              <option value="">Seçin...</option>
              {countryFiltered.payment.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Kargo Servisi">
            <select value={firma.shipping} onChange={e => update({ shipping: e.target.value })}
              className={inputCls}>
              <option value="">Seçin...</option>
              {countryFiltered.shipping.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          {isNL && (
            <Field label="e-Fatura (Peppol)">
              <select value={firma.einvoice} onChange={e => update({ einvoice: e.target.value })}
                className={inputCls}>
                {EINVOICE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Hollanda&apos;da B2B Peppol 2030&apos;da zorunlu olacak. Şimdilik opsiyonel.</p>
            </Field>
          )}
        </Section>

        <button type="button" onClick={() => setShowOptional(!showOptional)}
          className="w-full text-sm text-emerald-700 font-medium py-2 mb-3">
          {showOptional ? "▲ Opsiyonel alanları gizle" : "▼ Opsiyonel alanları göster (vergi, IBAN, web)"}
        </button>

        {showOptional && (
          <>
            <Section title={isNL ? "📄 Resmi Bilgi (KvK + BTW)" : "📄 Vergi Bilgisi"}>
              {isNL ? (
                <>
                  <Field label="KvK Number">
                    <input value={firma.kvk_no} onChange={e => update({ kvk_no: e.target.value })}
                      placeholder="12345678 (8 hane)" className={inputCls} inputMode="numeric" />
                  </Field>
                  <Field label="BTW Number">
                    <input value={firma.vergi_no} onChange={e => update({ vergi_no: e.target.value })}
                      placeholder={vergiNoPlaceholder} className={inputCls} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Vergi Dairesi">
                    <input value={firma.vergi_dairesi} onChange={e => update({ vergi_dairesi: e.target.value })}
                      placeholder="Bodrum VD" className={inputCls} />
                  </Field>
                  <Field label={vergiNoLabel}>
                    <input value={firma.vergi_no} onChange={e => update({ vergi_no: e.target.value })}
                      placeholder={vergiNoPlaceholder} className={inputCls} inputMode="numeric" />
                  </Field>
                </>
              )}
              <Field label="Kuruluş Yılı">
                <input value={firma.kurulus_yili} onChange={e => update({ kurulus_yili: e.target.value })}
                  placeholder="2010" className={inputCls} inputMode="numeric" />
              </Field>
            </Section>

            <Section title="📧 İletişim">
              <Field label="Kurumsal E-posta">
                <input type="email" value={firma.email_kurumsal} onChange={e => update({ email_kurumsal: e.target.value })}
                  placeholder="info@firma.nl" className={inputCls} />
              </Field>
              <Field label="Web Sitesi">
                <input type="url" value={firma.web_sitesi} onChange={e => update({ web_sitesi: e.target.value })}
                  placeholder="https://firma.nl" className={inputCls} />
              </Field>
            </Section>

            <Section title="💳 Banka">
              <Field label="IBAN">
                <input value={firma.iban} onChange={e => update({ iban: e.target.value })}
                  placeholder={ibanPlaceholder} className={inputCls} />
              </Field>
              <Field label="Banka">
                <input value={firma.banka} onChange={e => update({ banka: e.target.value })}
                  placeholder={isNL ? "ING, Rabobank, ABN AMRO..." : "Garanti BBVA, Iş Bankası..."} className={inputCls} />
              </Field>
              <Field label="Hesap Sahibi">
                <input value={firma.hesap_sahibi} onChange={e => update({ hesap_sahibi: e.target.value })}
                  placeholder="Ticari unvan veya kişi" className={inputCls} />
              </Field>
            </Section>

            <Section title="📝 Tanıtım">
              <Field label="Kısa Tanıtım (max 500 karakter)">
                <textarea rows={3} maxLength={500} value={firma.tanitim} onChange={e => update({ tanitim: e.target.value })}
                  placeholder="Bayilerinize gösterilen kısa açıklama" className={inputCls} />
              </Field>
            </Section>
          </>
        )}

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95 mt-4">
          {status === "saving" ? "Kaydediliyor..." : "📤 Profili Kaydet"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

        <div className="mt-6 text-center">
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="text-xs text-slate-500 hover:underline">
            WhatsApp&apos;a geri dön
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 space-y-3">
      <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
