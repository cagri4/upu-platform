"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

export default function SozlesmeYapPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [props, setProps] = useState<PropOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Selection
  const [selectedPropId, setSelectedPropId] = useState("");
  const [selectedCustId, setSelectedCustId] = useState("");

  // Form params
  const [commission, setCommission] = useState("2");
  const [duration, setDuration] = useState("3");
  const [exclusive, setExclusive] = useState(false);

  // AI generated text + edit state
  const [generatedText, setGeneratedText] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);

  // Result
  const [signLink, setSignLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // cookie-aware: token yoksa endpoint cookie session kabul eder
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

  if (status === "loading") {
    return <div className="text-center py-20"><div className="text-4xl">⏳</div></div>;
  }

  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-lg font-bold mb-2">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
          <div className="text-3xl mb-1">🤖</div>
          <h1 className="text-xl font-bold">Sözleşme hazırlanıyor...</h1>
          <p className="text-amber-200 text-sm mt-1">AI 5-10 saniyede taslak metni hazırlıyor.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="text-5xl animate-pulse mb-4">📝</div>
          <p className="text-sm text-slate-500">Yapay zeka çalışıyor...</p>
        </div>
      </div>
    );
  }

  if (status === "preview" || status === "saving") {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
          <div className="text-3xl mb-1">📄</div>
          <h1 className="text-xl font-bold">Sözleşme Taslağı</h1>
          <p className="text-amber-200 text-sm mt-1">Metni inceleyin. İsterseniz düzenleyin, sonra kaydedin.</p>
        </div>

        {editing ? (
          <textarea
            value={generatedText}
            onChange={e => { setGeneratedText(e.target.value); setEdited(true); }}
            rows={20}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl p-4 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
            <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed">{generatedText}</pre>
          </div>
        )}

        {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

        <div className="flex gap-2">
          <button
            onClick={() => setEditing(v => !v)}
            disabled={status === "saving"}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-95 transition"
          >
            {editing ? "👁 Önizleme" : "✏️ Düzenle"}
          </button>
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition"
          >
            {status === "saving" ? "Kaydediliyor..." : "✅ Kaydet"}
          </button>
        </div>

        <button
          onClick={() => setStatus("select")}
          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs hover:bg-slate-50 transition"
        >
          ← Geri (yeniden seç)
        </button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3">📝</div>
          <h1 className="text-xl font-bold mb-2">Sözleşme oluşturuldu!</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">İmza linki müşterinize iletilebilir.</p>
          {signLink && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 break-all mb-3">
              {signLink}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition"
            >
              {copied ? "✅ Kopyalandı" : "📋 Linki Kopyala"}
            </button>
            <a
              href={signLink ? `https://wa.me/?text=${encodeURIComponent(signLink)}` : "#"}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-sm text-center active:scale-95 transition"
            >
              💬 WA ile Paylaş
            </a>
          </div>
        </div>

        <a
          href={`/tr/sozlesmelerim?t=${encodeURIComponent(token)}`}
          className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-semibold text-center active:scale-95 transition"
        >
          📋 Sözleşmelerime Git
        </a>
        <a
          href={`/tr/panel?t=${encodeURIComponent(token)}`}
          className="block w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium text-center hover:bg-slate-50 transition"
        >
          🖥 Panele Dön
        </a>
      </div>
    );
  }

  // status === "select"
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">📝</div>
        <h1 className="text-xl font-bold">Sözleşme Yap</h1>
        <p className="text-amber-200 text-sm mt-1">Mülk + müşteri seç, parametreleri belirle, AI taslak hazırlasın.</p>
      </div>

      {/* Mülk seç */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">🏠 Mülk seç *</label>
        {props.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz mülk yok. Önce mülk eklemelisiniz.</p>
        ) : (
          <select
            value={selectedPropId}
            onChange={e => setSelectedPropId(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 text-base text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
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
      </div>

      {/* Müşteri seç */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">👤 Müşteri seç *</label>
        {customers.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz müşteri yok. Önce müşteri eklemelisiniz.</p>
        ) : (
          <select
            value={selectedCustId}
            onChange={e => setSelectedCustId(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 text-base text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
          >
            <option value="">— Seçin —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Parametreler */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">⚙️ Sözleşme parametreleri</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Komisyon (%)</label>
            <input
              type="number" min="0" max="20" step="0.5"
              value={commission} onChange={e => setCommission(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Süre (ay)</label>
            <input
              type="number" min="1" max="60"
              value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox" checked={exclusive}
            onChange={e => setExclusive(e.target.checked)}
            className="w-4 h-4"
          />
          <span>🔒 Münhasır yetki sözleşmesi</span>
        </label>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={!selectedPropId || !selectedCustId}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold text-lg shadow-lg active:scale-95 transition"
        >
          🤖 AI ile Sözleşme Üret
        </button>
        <a
          href={`/tr/panel?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-4 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-95 transition whitespace-nowrap"
        >
          🖥 Panele
        </a>
      </div>
    </div>
  );
}
