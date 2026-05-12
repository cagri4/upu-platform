"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Target,
  FileText,
  Loader2,
  AlertTriangle,
  Check,
  Sparkles,
  Plus,
  MessageCircle,
} from "lucide-react";

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

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition";

export default function MusteriEkleFormPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const editId = searchParams.get("id");
  const isEdit = !!editId;

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isEdit) {
      const tokenQs = token ? `&t=${encodeURIComponent(token)}` : "";
      fetch(`/api/musteri/get?id=${encodeURIComponent(editId!)}${tokenQs}`, { credentials: "same-origin" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) { setStatus("error"); setError(d.error || "Müşteri yüklenemedi."); return; }
          const c = d.customer as Record<string, unknown>;
          setName(String(c.name || ""));
          setPhone(String(c.phone || ""));
          setEmail(String(c.email || ""));
          if (Array.isArray(c.looking_for)) setLookingFor(c.looking_for as string[]);
          if (Array.isArray(c.property_type)) setPropertyTypes(c.property_type as string[]);
          if (typeof c.rooms === "string" && c.rooms) {
            setRooms(c.rooms.split(",").map(s => s.trim()).filter(Boolean));
          }
          setBudgetMin(c.budget_min != null ? String(c.budget_min) : "");
          setBudgetMax(c.budget_max != null ? String(c.budget_max) : "");
          setLocation(String(c.location || ""));
          setNotes(String(c.notes || ""));
          setStatus("form");
        })
        .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
      return;
    }

    const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/musteri/init${tokenQs}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token, isEdit, editId]);

  function toggleType(t: string) {
    setError("");
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function toggleLookingFor(t: string) {
    setError("");
    setLookingFor(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function toggleRoom(r: string) {
    setError("");
    setRooms(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError("İsim en az 2 karakter."); return; }
    if (phone.trim().length < 7) { setError("Geçerli telefon gerekli."); return; }
    if (lookingFor.length === 0) { setError("En az bir ilan tipi seçin (Satılık / Kiralık)."); return; }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/musteri/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token,
          ...(isEdit ? { id: editId } : {}),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          looking_for: lookingFor,
          property_type: propertyTypes,
          rooms: rooms.length > 0 ? rooms.join(", ") : null,
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

  if (status === "loading") {
    return (
      <Center>
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">Yükleniyor...</p>
      </Center>
    );
  }
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }
  if (status === "done") {
    return (
      <DoneState
        isEdit={isEdit}
        panelHref={token ? `/tr/panel?t=${encodeURIComponent(token)}` : "/tr/panel"}
        addMoreHref={token ? `/api/panel/start?cmd=musteriEkle&t=${encodeURIComponent(token)}` : `/api/panel/start?cmd=musteriEkle`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Hero */}
        <div className="flex items-center gap-3">
          <a
            href={token ? `/tr/panel?t=${encodeURIComponent(token)}` : "/tr/panel"}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
          </a>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isEdit ? "Müşteri Düzenle" : "Yeni Müşteri"}
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          {isEdit ? "Bilgileri güncelleyin ve kaydedin." : "Ne kadar bilgi girerseniz AI eşleştirmesi o kadar isabetli olur."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Kişisel Bilgiler" Icon={User}>
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

          <Section title="Aradığı Mülk" Icon={Target}>
            <PillGroup
              label="İlan Tipi"
              count={lookingFor.length}
              cols={2}
            >
              {[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}].map(o => (
                <Pill key={o.id} active={lookingFor.includes(o.id)} onClick={() => toggleLookingFor(o.id)}>
                  {o.label}
                </Pill>
              ))}
            </PillGroup>

            <PillGroup label="Mülk Tipi" count={propertyTypes.length} cols={3}>
              {PROPERTY_TYPES.map(t => (
                <Pill key={t.id} active={propertyTypes.includes(t.id)} onClick={() => toggleType(t.id)} sm>
                  {t.label}
                </Pill>
              ))}
            </PillGroup>

            <PillGroup label="Oda" count={rooms.length} cols={3}>
              {ROOMS.map(r => (
                <Pill key={r} active={rooms.includes(r)} onClick={() => toggleRoom(r)}>
                  {r}
                </Pill>
              ))}
            </PillGroup>

            <Field label="Bölge / Mahalle">
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Örn. Bitez, Yalıkavak" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Bütçe Min (₺)">
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMin ? Number(budgetMin).toLocaleString("tr-TR") : ""}
                  onChange={e => setBudgetMin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Min"
                  className={inputCls}
                />
              </Field>
              <Field label="Bütçe Max (₺)">
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMax ? Number(budgetMax).toLocaleString("tr-TR") : ""}
                  onChange={e => setBudgetMax(e.target.value.replace(/\D/g, ""))}
                  placeholder="Max"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="Notlar" Icon={FileText}>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Müşteri tercihleri, özel notlar..." className={`${inputCls} resize-none`} />
          </Section>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}
        </form>
      </div>

      <StickyBottom>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={status === "saving"}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          {status === "saving" ? "Kaydediliyor..." : (isEdit ? "Güncelle" : "Kaydet")}
        </button>
      </StickyBottom>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof User; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PillGroup({ label, count, cols, children }: { label: string; count: number; cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">({count} seçili)</span>
      </label>
      <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {children}
      </div>
    </div>
  );
}

function Pill({ active, onClick, sm = false, children }: { active: boolean; onClick: () => void; sm?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2.5 rounded-xl font-medium transition active:scale-[0.97] ${
        sm ? "text-xs" : "text-sm"
      } ${
        active
          ? "bg-emerald-600 text-white border border-emerald-600"
          : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500"
      }`}
    >
      {children}
    </button>
  );
}

function StickyBottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 z-10">
      <div className="max-w-md mx-auto flex gap-2">{children}</div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}

function DoneState({ isEdit, panelHref, addMoreHref }: { isEdit: boolean; panelHref: string; addMoreHref: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          {isEdit ? (
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          ) : (
            <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
          {isEdit ? "Müşteri güncellendi" : "Müşteri kaydedildi"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          {isEdit ? "Değişiklikler kaydedildi." : "Müşterileriniz panelde listelenir."}
        </p>
        <div className="w-full space-y-2">
          <a href={panelHref} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold py-4 rounded-2xl shadow-sm active:scale-[0.98] transition">
            Panele Dön
          </a>
          {!isEdit && (
            <a href={addMoreHref} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Yeni Müşteri Ekle
            </a>
          )}
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition">
            <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    </div>
  );
}
