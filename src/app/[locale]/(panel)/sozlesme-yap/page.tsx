"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Home,
  User,
  Settings,
  Lock,
  Sparkles,
  Eye,
  Pencil,
  Check,
  Copy,
  MessageCircle,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

interface PropOption {
  id: string;
  title: string;
  listing_type: string | null;
  type: string | null;
  price: number | null;
  location_district: string | null;
  location_neighborhood: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  looking_for: string[] | null;
}

type Status = "loading" | "select" | "generating" | "preview" | "saving" | "done" | "error";

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition";

export default function SozlesmeYapPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [props, setProps] = useState<PropOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [selectedPropId, setSelectedPropId] = useState("");
  const [selectedCustId, setSelectedCustId] = useState("");

  const [commission, setCommission] = useState("2");
  const [duration, setDuration] = useState("3");
  const [exclusive, setExclusive] = useState(false);

  const [generatedText, setGeneratedText] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);

  const [signLink, setSignLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/sozlesme/init?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
        setProps(d.properties || []);
        setCustomers(d.customers || []);
        setStatus("select");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handleGenerate() {
    if (!selectedPropId || !selectedCustId) { setError("Mülk ve müşteri seçimi zorunlu."); return; }
    setStatus("generating"); setError("");
    try {
      const res = await fetch("/api/sozlesme/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          property_id: selectedPropId,
          customer_id: selectedCustId,
          commission: Number(commission) || 2,
          duration: Number(duration) || 3,
          exclusive,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("select"); setError(d.error || "AI üretim hatası."); return; }
      setGeneratedText(d.generated_text || "");
      setEdited(false);
      setStatus("preview");
    } catch {
      setStatus("select"); setError("Bağlantı hatası.");
    }
  }

  async function handleSave() {
    setStatus("saving"); setError("");
    try {
      const res = await fetch("/api/sozlesme/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          property_id: selectedPropId,
          customer_id: selectedCustId,
          commission: Number(commission) || 2,
          duration: Number(duration) || 3,
          exclusive,
          generated_text: generatedText,
          edited,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("preview"); setError(d.error || "Kaydedilemedi."); return; }
      setSignLink(d.sign_link || "");
      setStatus("done");
    } catch {
      setStatus("preview"); setError("Bağlantı hatası.");
    }
  }

  function copyLink() {
    if (!signLink) return;
    navigator.clipboard.writeText(signLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (status === "loading") return <LoadingState variant="card" />;

  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
        <h1 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <a
            href={`/tr/sozlesmelerim?t=${encodeURIComponent(token)}`}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
          </a>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sözleşme Hazırlanıyor</h1>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-pulse" strokeWidth={2.2} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">AI 5-10 saniyede taslak metni hazırlıyor...</p>
        </div>
      </div>
    );
  }

  if (status === "preview" || status === "saving") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStatus("select")}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sözleşme Taslağı</h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          Metni inceleyin. İsterseniz düzenleyin, sonra kaydedin.
        </p>

        {editing ? (
          <textarea
            value={generatedText}
            onChange={e => { setGeneratedText(e.target.value); setEdited(true); }}
            rows={20}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed">{generatedText}</pre>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setEditing(v => !v)}
            disabled={status === "saving"}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
          >
            {editing ? <><Eye className="w-4 h-4" strokeWidth={2.2} /> Önizleme</> : <><Pencil className="w-4 h-4" strokeWidth={2.2} /> Düzenle</>}
          </button>
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
            {status === "saving" ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Sözleşme oluşturuldu</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">İmza linki müşterinize iletilebilir.</p>
          {signLink && (
            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 break-all mb-3 font-mono">
              {signLink}
            </div>
          )}
          <div className="w-full flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
            >
              {copied ? <><Check className="w-4 h-4" strokeWidth={2.5} /> Kopyalandı</> : <><Copy className="w-4 h-4" strokeWidth={2.2} /> Kopyala</>}
            </button>
            <a
              href={signLink ? `https://wa.me/?text=${encodeURIComponent(signLink)}` : "#"}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={2.2} /> WA ile Paylaş
            </a>
          </div>
        </div>

        <a
          href={`/tr/sozlesmelerim?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <ClipboardList className="w-4 h-4" strokeWidth={2.2} /> Sözleşmelerime Git
        </a>
        <a
          href={`/tr/panel?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-center w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
        >
          Panele Dön
        </a>
      </div>
    );
  }

  // status === "select"
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <a
          href={`/tr/sozlesmelerim?t=${encodeURIComponent(token)}`}
          className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
        </a>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sözleşme Yap</h1>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        Mülk + müşteri seç, parametreleri belirle, AI taslak hazırlasın.
      </p>

      {/* Mülk seç */}
      <Section title="Mülk seç *" Icon={Home}>
        {props.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Henüz mülk yok. Önce mülk eklemelisiniz.</p>
        ) : (
          <select
            value={selectedPropId}
            onChange={e => setSelectedPropId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Seçin —</option>
            {props.map(p => {
              const loc = [p.location_neighborhood, p.location_district].filter(Boolean).join(", ");
              const lt = p.listing_type === "kiralik" ? "Kiralık" : "Satılık";
              return (
                <option key={p.id} value={p.id}>
                  {p.title || "İsimsiz"} — {lt}{loc ? ` · ${loc}` : ""}
                </option>
              );
            })}
          </select>
        )}
      </Section>

      {/* Müşteri seç */}
      <Section title="Müşteri seç *" Icon={User}>
        {customers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Henüz müşteri yok. Önce müşteri eklemelisiniz.</p>
        ) : (
          <select
            value={selectedCustId}
            onChange={e => setSelectedCustId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Seçin —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        )}
      </Section>

      {/* Parametreler */}
      <Section title="Sözleşme parametreleri" Icon={Settings}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Komisyon (%)</label>
            <input
              type="number" min="0" max="20" step="0.5"
              value={commission} onChange={e => setCommission(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Süre (ay)</label>
            <input
              type="number" min="1" max="60"
              value={duration} onChange={e => setDuration(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox" checked={exclusive}
            onChange={e => setExclusive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500/20 focus:ring-2"
          />
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
            Münhasır yetki sözleşmesi
          </span>
        </label>
      </Section>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={!selectedPropId || !selectedCustId}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <Sparkles className="w-5 h-5" strokeWidth={2.2} />
          AI ile Sözleşme Üret
        </button>
        <a
          href={`/tr/panel?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-4 rounded-2xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition whitespace-nowrap"
        >
          Panele
        </a>
      </div>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof Home; children: React.ReactNode }) {
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
