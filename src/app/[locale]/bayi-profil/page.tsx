"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Firma {
  ticari_unvan: string;
  yetkili_adi: string;
  ofis_telefon: string;
  ofis_adresi: string;
  sektor: string;
  vergi_dairesi: string;
  vergi_no: string;
  kurulus_yili: string;
  email_kurumsal: string;
  web_sitesi: string;
  iban: string;
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
  { id: "gida", label: "Gıda" },
  { id: "otomotiv", label: "Otomotiv" },
  { id: "tekstil", label: "Tekstil" },
  { id: "diger", label: "Diğer" },
];

const empty: Firma = {
  ticari_unvan: "", yetkili_adi: "", ofis_telefon: "", ofis_adresi: "", sektor: "",
  vergi_dairesi: "", vergi_no: "", kurulus_yili: "", email_kurumsal: "", web_sitesi: "",
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

  async function save() {
    setError("");
    if (!firma.ticari_unvan.trim() || firma.ticari_unvan.trim().length < 2) { setError("Ticari unvan girin."); return; }
    if (!firma.yetkili_adi.trim() || firma.yetkili_adi.trim().length < 2) { setError("Yetkili adı girin."); return; }
    if (firma.ofis_telefon.replace(/\D/g, "").length < 10) { setError("Geçerli telefon girin."); return; }
    if (!firma.ofis_adresi.trim()) { setError("Ofis adresi girin."); return; }
    if (!firma.sektor) { setError("Sektör seçin."); return; }

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

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🏢</div>
          <h1 className="text-xl font-bold">Firma Profili</h1>
          <p className="text-emerald-100 text-sm mt-1">5 zorunlu alan, 90 saniye. Gerisi sonra.</p>
        </div>

        <Section title="🔴 Zorunlu">
          <Field label="Ticari Unvan">
            <input value={firma.ticari_unvan} onChange={e => update({ ticari_unvan: e.target.value })}
              placeholder="ABC Dağıtım Ltd." className={inputCls} required />
          </Field>
          <Field label="Yetkili Adı Soyadı">
            <input value={firma.yetkili_adi} onChange={e => update({ yetkili_adi: e.target.value })}
              placeholder="Ahmet Yılmaz" className={inputCls} required />
          </Field>
          <Field label="Ofis Telefonu">
            <input type="tel" value={firma.ofis_telefon} onChange={e => update({ ofis_telefon: e.target.value })}
              placeholder="0212 XXX XX XX" className={inputCls} required />
          </Field>
          <Field label="Ofis Adresi">
            <textarea rows={2} value={firma.ofis_adresi} onChange={e => update({ ofis_adresi: e.target.value })}
              placeholder="İl, ilçe, mahalle, sokak" className={inputCls} required />
          </Field>
          <Field label="Sektör">
            <select value={firma.sektor} onChange={e => update({ sektor: e.target.value })}
              className={inputCls} required>
              <option value="">Seçin...</option>
              {SEKTORLER.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        </Section>

        <button type="button" onClick={() => setShowOptional(!showOptional)}
          className="w-full text-sm text-emerald-700 font-medium py-2 mb-3">
          {showOptional ? "▲ Opsiyonel alanları gizle" : "▼ Opsiyonel alanları göster (vergi, IBAN, web)"}
        </button>

        {showOptional && (
          <>
            <Section title="📄 Vergi Bilgisi">
              <Field label="Vergi Dairesi">
                <input value={firma.vergi_dairesi} onChange={e => update({ vergi_dairesi: e.target.value })}
                  placeholder="Bodrum VD" className={inputCls} />
              </Field>
              <Field label="Vergi No / TCKN">
                <input value={firma.vergi_no} onChange={e => update({ vergi_no: e.target.value })}
                  placeholder="10 veya 11 hane" className={inputCls} inputMode="numeric" />
              </Field>
              <Field label="Kuruluş Yılı">
                <input value={firma.kurulus_yili} onChange={e => update({ kurulus_yili: e.target.value })}
                  placeholder="2010" className={inputCls} inputMode="numeric" />
              </Field>
            </Section>

            <Section title="📧 İletişim">
              <Field label="Kurumsal E-posta">
                <input type="email" value={firma.email_kurumsal} onChange={e => update({ email_kurumsal: e.target.value })}
                  placeholder="info@firma.com" className={inputCls} />
              </Field>
              <Field label="Web Sitesi">
                <input type="url" value={firma.web_sitesi} onChange={e => update({ web_sitesi: e.target.value })}
                  placeholder="https://firma.com" className={inputCls} />
              </Field>
            </Section>

            <Section title="💳 Banka">
              <Field label="IBAN">
                <input value={firma.iban} onChange={e => update({ iban: e.target.value })}
                  placeholder="TR00 0000 0000 0000 0000 0000 00" className={inputCls} />
              </Field>
              <Field label="Banka">
                <input value={firma.banka} onChange={e => update({ banka: e.target.value })}
                  placeholder="Garanti BBVA" className={inputCls} />
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
