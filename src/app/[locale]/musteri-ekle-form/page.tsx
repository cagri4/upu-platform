"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

const PROPERTY_TYPES = [
  { id: "daire", label: "Daire" },
  { id: "villa", label: "Villa" },
  { id: "mustakil", label: "Müstakil" },
  { id: "rezidans", label: "Rezidans" },
  { id: "yazlik", label: "Yazlık" },
  { id: "arsa", label: "Arsa" },
  { id: "dukkan", label: "Dükkan" },
  { id: "buro_ofis", label: "Büro/Ofis" },
];

const ROOMS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1"];

type Status = "loading" | "form" | "saving" | "done" | "error";

export default function MusteriEkleFormPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [listingType, setListingType] = useState("satilik");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [rooms, setRooms] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/musteri/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  function toggleType(t: string) {
    setError("");
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError("İsim en az 2 karakter."); return; }
    if (phone.trim().length < 7) { setError("Geçerli telefon gerekli."); return; }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/musteri/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          listing_type: listingType,
          property_type: propertyTypes,
          rooms: rooms || null,
          budget_min: budgetMin ? Number(budgetMin) : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
          location: location.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("form"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("form");
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
    <div className="text-5xl mb-3">🎉</div>
    <h1 className="text-xl font-bold mb-2">Müşteri kaydedildi!</h1>
    <p className="text-slate-600 text-sm mb-6">WhatsApp&apos;a dönerek devam edebilirsiniz.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`}
      className="block bg-green-600 text-white px-6 py-4 rounded-xl font-semibold text-lg">💬 WhatsApp&apos;a Dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🤝</div>
          <h1 className="text-xl font-bold">Müşteri Ekle</h1>
          <p className="text-emerald-100 text-sm mt-1">Müşterinin bilgilerini ve aradığı kriterleri girin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Section title="👤 Kişisel Bilgiler">
            <Field label="Ad Soyad *">
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="Ahmet Yılmaz" className={inputCls} />
            </Field>
            <Field label="Telefon *">
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XX XXX XX XX" className={inputCls} />
            </Field>
            <Field label="E-posta">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opsiyonel" className={inputCls} />
            </Field>
          </Section>

          <Section title="🎯 Aradığı Mülk">
            <Pills label="İlan Tipi" value={listingType} options={[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}]} onPick={setListingType} />
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Mülk Tipi <span className="text-slate-400 text-xs">({propertyTypes.length} seçili)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PROPERTY_TYPES.map(t => (
                  <button type="button" key={t.id} onClick={() => toggleType(t.id)}
                    className={`py-2 rounded-lg text-xs font-medium border-2 ${propertyTypes.includes(t.id) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Pills label="Oda" value={rooms} options={ROOMS.map(r => ({id:r,label:r}))} onPick={setRooms} cols={3} />
            <Field label="Bölge / Mahalle">
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Örn. Bitez, Yalıkavak" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Bütçe Min (₺)">
                <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="Min" min="0" className={inputCls} />
              </Field>
              <Field label="Bütçe Max (₺)">
                <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="Max" min="0" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="📝 Notlar">
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Müşteri tercihleri, özel notlar..." className={inputCls} />
          </Section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <button type="submit" disabled={status === "saving"}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
            {status === "saving" ? "Kaydediliyor..." : "✅ Müşteriyi Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
    <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium text-slate-900 mb-2">{label}</label>
    {children}
  </div>;
}

function Pills({ label, value, options, onPick, cols }: { label: string; value: string; options: { id: string; label: string }[]; onPick: (v: string) => void; cols?: number }) {
  return <div>
    <label className="block text-sm font-medium text-slate-900 mb-2">{label}</label>
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
      {options.map(o => (
        <button type="button" key={o.id} onClick={() => onPick(o.id)}
          className={`py-2.5 rounded-lg text-sm font-medium border-2 ${value === o.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"}`}>
          {o.label}
        </button>
      ))}
    </div>
  </div>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
