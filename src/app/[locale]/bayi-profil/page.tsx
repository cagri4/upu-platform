"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";
type Country = "NL" | "TR" | "BE" | "DE";
type Currency = "EUR" | "TRY" | "USD" | "GBP";
type Locale = "tr-NL" | "tr-TR" | "nl-NL" | "en-US";

// UI dropdown 3 seçenek (Türkçe/Nederlands/English). State hala full
// Locale tutar; country'ye göre tr-NL ↔ tr-TR otomatik expand olur.
type LocaleUI = "tr" | "nl" | "en";

function uiLocaleFromState(loc: Locale): LocaleUI {
  if (loc === "tr-NL" || loc === "tr-TR") return "tr";
  if (loc === "nl-NL") return "nl";
  return "en";
}

function stateLocaleFromUi(uiLoc: LocaleUI, country: Country): Locale {
  if (uiLoc === "tr") return country === "TR" ? "tr-TR" : "tr-NL";
  if (uiLoc === "nl") return "nl-NL";
  return "en-US";
}

interface Firma {
  // Lokalizasyon
  country: Country;
  currency: Currency;
  locale: Locale;

  // Muhasebe yazılımı seçimi (onboarding sonrası ayarlardan değiştirilebilir).
  // 2026-05-02: dağıtıcı kendi tedarikçilerini kullanıyor — kargo/ödeme/e-fatura
  // adapter'ları kaldırıldı, sadece muhasebe entegrasyonu kalır.
  accounting: string;     // yuki | exact | snelstart | logo | none

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

// 6 ana sektör — sektör bazlı demo seed setlerine birebir eşleşiyor.
// "diger" seçilirse default boya seti yüklenir + inline help mesajı.
const SEKTORLER: Array<{ id: string; label: string }> = [
  { id: "boya",     label: "Boya & Yapı Kimyasalı" },
  { id: "gida",     label: "Gıda & Bakliyat" },
  { id: "hirdavat", label: "Hırdavat & İnşaat" },
  { id: "tekstil",  label: "Tekstil & Konfeksiyon" },
  { id: "temizlik", label: "Kişisel Bakım & Temizlik" },
  { id: "diger",    label: "Diğer (sektörünüze yakın olan seçilebilir)" },
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

// Dil dropdown — Türkçe (Hollanda/Türkiye varyantı yok, country zaten
// ayrı alan). 3 sade seçenek.
const LOCALE_OPTIONS: Array<{ id: LocaleUI; label: string }> = [
  { id: "tr", label: "🇹🇷 Türkçe" },
  { id: "nl", label: "🇳🇱 Nederlands" },
  { id: "en", label: "🇬🇧 English" },
];

// Muhasebe yazılımı listesi — 10 popüler seçenek, country'ye göre filtreli.
// Türkiye: Logo (Tiger/GO) + Logo İşbaşı + Mikro + Paraşüt + Netsis
// Hollanda: Exact Online + Yuki + SnelStart + Twinfield + Moneybird
const ACCOUNTING_OPTIONS: Array<{ id: string; label: string; country?: Country[] }> = [
  // 🇹🇷 Türkiye
  { id: "logo",        label: "Logo (Tiger / GO)", country: ["TR"] },
  { id: "logo_isbasi", label: "Logo İşbaşı",       country: ["TR"] },
  { id: "mikro",       label: "Mikro",             country: ["TR"] },
  { id: "parasut",     label: "Paraşüt",           country: ["TR"] },
  { id: "netsis",      label: "Netsis",            country: ["TR"] },
  // 🇳🇱 Hollanda / Belçika
  { id: "exact",       label: "Exact Online",      country: ["NL", "BE"] },
  { id: "yuki",        label: "Yuki",              country: ["NL", "BE"] },
  { id: "snelstart",   label: "SnelStart",         country: ["NL"] },
  { id: "twinfield",   label: "Twinfield",         country: ["NL", "BE"] },
  { id: "moneybird",   label: "Moneybird",         country: ["NL"] },
  // ⚪ Ortak
  { id: "none",        label: "Henüz yok / Manuel" },
];

const empty: Firma = {
  country: "NL", currency: "EUR", locale: "tr-NL",
  accounting: "",
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
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-profil/init${qs}`, { credentials: "same-origin" })
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

  // Muhasebe yazılımı dropdown — country FİLTRESİ YOK. Hollanda'daki Türk
  // dağıtıcının Logo İşbaşı kullanması yaygın senaryo; tersi de geçerli.
  // Sıralama: kullanıcının ülkesi önce, sonra diğer bölge, sonra "Manuel".
  const accountingOrdered = useMemo(() => {
    const userCountry = firma.country;
    const matches = ACCOUNTING_OPTIONS.filter(o => o.country?.includes(userCountry));
    const others = ACCOUNTING_OPTIONS.filter(o => o.country && !o.country.includes(userCountry));
    const generic = ACCOUNTING_OPTIONS.filter(o => !o.country);
    return [...matches, ...others, ...generic];
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
    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div>
    <h1 className="text-xl font-bold mb-2">Profiliniz hazır!</h1>
    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Sıradaki adım WhatsApp&apos;a düştü.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  const inputCls = "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm";
  const isNL = firma.country === "NL" || firma.country === "BE" || firma.country === "DE";
  const phonePlaceholder = isNL ? "+31 6 12345678" : "0212 XXX XX XX";
  const ibanPlaceholder = isNL ? "NL00 ABCD 0123 4567 89" : "TR00 0000 0000 0000 0000 0000 00";
  const vergiNoPlaceholder = isNL ? "NL123456789B01 (BTW)" : "10 veya 11 hane";
  const vergiNoLabel = isNL ? "BTW Number" : "Vergi No / TCKN";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-3">
          <div className="text-3xl mb-1">🏢</div>
          <h1 className="text-xl font-bold">Firma Profili</h1>
          <p className="text-emerald-100 text-sm mt-1">Zorunlu alanlar + ülke ve yazılım tercihleri. ~5 dakika. Daha sonra güncelleyebilirsiniz.</p>
        </div>

        <p className="text-xs text-slate-500 mb-3 px-1">💡 İpucu: Eksik bilgileri sonradan da güncelleyebilirsiniz, ama zorunlu alanları doldurmadan kayıt yapılmaz.</p>

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
            <select value={uiLocaleFromState(firma.locale)}
              onChange={e => update({ locale: stateLocaleFromUi(e.target.value as LocaleUI, firma.country) })}
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
            {firma.sektor === "diger" && (
              <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded px-2 py-1.5 mt-1">
                ℹ️ Sektörünüz listede yok. Demo için en yakın sektörü seçmenizi öneririz — sistem yapısı aynı, sadece örnek ürün/bayi listesi farklılaşır. Yayınlanma sonrası sektörünüze özel uyarlama yaparız.
              </p>
            )}
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

        <Section title="🔌 Muhasebe Entegrasyonu">
          <p className="text-[11px] text-slate-500 -mt-1 mb-2">
            Şu an kullandığınız muhasebe yazılımını seçin — sistemimiz bayi listenizi, ürünlerinizi, açık faturalarınızı oradan okur. Henüz yoksa &quot;Henüz yok / Manuel&quot; seçin (CSV import + elle ekleme ile çalışır).
          </p>
          <Field label="Muhasebe Yazılımı">
            <select value={firma.accounting} onChange={e => update({ accounting: e.target.value })}
              className={inputCls}>
              <option value="">Seçin...</option>
              {accountingOrdered.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Kargo, ödeme tahsilatı ve e-fatura için kendi sisteminizi kullanmaya devam edebilirsiniz — bu katmanlara karışmıyoruz.
            </p>
          </Field>
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

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={save} disabled={status === "saving"}
            className="bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
            {status === "saving" ? "Kaydediliyor..." : "✅ Kaydet"}
          </button>
          <a
            href={token ? `/tr/bayi-panel?t=${encodeURIComponent(token)}` : `https://wa.me/${BOT_WA_NUMBER}`}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-semibold text-center active:scale-95 hover:bg-slate-50 flex items-center justify-center"
          >
            🏠 Panele Dön
          </a>
        </div>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 space-y-3">
      <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
