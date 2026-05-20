"use client";

/**
 * Market profil düzenleme — full-screen mobile form (shell DIŞI).
 *
 * WA WebView'da render olur. (market-panel) shell'inin altına alınmaz —
 * emlak `profil-duzenle` pattern'i ile aynı: form sayfaları full-screen
 * `max-w-md mx-auto`. Layout token validate etmez, sayfa kendi yapar.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const SEKTOR_OPTIONS = [
  { value: "bakkal", label: "Bakkal / Mini Market" },
  { value: "supermarket", label: "Supermarket" },
  { value: "toptan", label: "Toptan / Grossmarket" },
  { value: "sarkuteri", label: "Şarküteri / Kasap" },
  { value: "manav", label: "Manav" },
];

const URUN_SAYISI_OPTIONS = [
  { value: "1-100", label: "1 — 100 çeşit" },
  { value: "100-500", label: "100 — 500 çeşit" },
  { value: "500+", label: "500+ çeşit" },
];

interface InitData {
  displayName: string | null;
  marketAdi: string | null;
  sektor: string | null;
  urunSayisi: string | null;
  adres: string | null;
  briefingEnabled: boolean;
}

export default function MarketProfilimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<"loading" | "ready" | "error" | "saving" | "saved">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [marketAdi, setMarketAdi] = useState("");
  const [sektor, setSektor] = useState("");
  const [urunSayisi, setUrunSayisi] = useState("");
  const [adres, setAdres] = useState("");
  const [briefingEnabled, setBriefingEnabled] = useState(true);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/market/profil/init${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: InitData & { error?: string }) => {
        if (d.error) { setState("error"); setErrorMsg(d.error); return; }
        setDisplayName(d.displayName || "");
        setMarketAdi(d.marketAdi || "");
        setSektor(d.sektor || "");
        setUrunSayisi(d.urunSayisi || "");
        setAdres(d.adres || "");
        setBriefingEnabled(d.briefingEnabled ?? true);
        setState("ready");
      })
      .catch(() => { setState("error"); setErrorMsg("Bağlantı hatası."); });
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!marketAdi.trim()) {
      setErrorMsg("Market adı zorunlu");
      return;
    }
    setState("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/market/profil/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          display_name: displayName,
          market_adi: marketAdi,
          sektor,
          urun_sayisi: urunSayisi,
          adres,
          briefing_enabled: briefingEnabled,
        }),
      });
      const d = await res.json();
      if (d.error) { setState("ready"); setErrorMsg(d.error); return; }
      setState("saved");
    } catch {
      setState("ready");
      setErrorMsg("Kayıt hatası");
    }
  }

  function handleBack() {
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch { /* fall through */ }
    window.location.href = "https://wa.me/31644967207";
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-4xl">⏳</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Hata</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{errorMsg}</p>
          <a
            href="https://wa.me/31644967207"
            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            WhatsApp&apos;a dön
          </a>
        </div>
      </div>
    );
  }

  if (state === "saved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-bold mb-2">Kaydedildi</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Market profiliniz güncellendi.</p>
          <button
            onClick={handleBack}
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-5 shadow-lg mb-4">
          <h1 className="text-xl font-bold">Profilim</h1>
          <p className="text-amber-100 text-sm mt-1">Market bilgilerinizi düzenleyin.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Adınız</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
              placeholder="Mehmet Yılmaz"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Market / Mağaza Adı <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={marketAdi}
              onChange={(e) => setMarketAdi(e.target.value)}
              required
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
              placeholder="ABC Market"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sektör</label>
            <div className="space-y-1.5">
              {SEKTOR_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="sektor"
                    value={opt.value}
                    checked={sektor === opt.value}
                    onChange={(e) => setSektor(e.target.value)}
                    className="text-amber-600 focus:ring-amber-400"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ürün Sayısı</label>
            <div className="space-y-1.5">
              {URUN_SAYISI_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="urun_sayisi"
                    value={opt.value}
                    checked={urunSayisi === opt.value}
                    onChange={(e) => setUrunSayisi(e.target.value)}
                    className="text-amber-600 focus:ring-amber-400"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Adres (Opsiyonel)</label>
            <textarea
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none resize-none"
              placeholder="Den Haag, Hollanda"
            />
          </div>

          <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={briefingEnabled}
              onChange={(e) => setBriefingEnabled(e.target.checked)}
              className="mt-0.5 text-amber-600 focus:ring-amber-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Sabah günlük brifing göndersin (dünkü ciro, kritik stok, vade durumu).
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-4 py-3 rounded-lg text-sm font-semibold transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={state === "saving"}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {state === "saving" ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
