"use client";

/**
 * Market profil düzenleme — full-screen mobile form (shell DIŞI).
 *
 * Banking primitive port: HeroBanner header + LoadingState + BackButton
 * + emerald focus ring (banking standardı). WA WebView'da render olur.
 * Form sayfaları (market-panel) shell altına alınmaz — emlak/bayi
 * `profil-duzenle` pattern'i ile aynı: full-screen `max-w-md mx-auto`.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Check, AlertTriangle, MessageCircle } from "lucide-react";
import { HeroBanner, LoadingState, BackButton } from "@/components/banking";

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
    return <LoadingState label="Profil yükleniyor" />;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7" strokeWidth={2.2} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Hata</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{errorMsg}</p>
          <a
            href="https://wa.me/31644967207"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition active:scale-95"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={2.4} />
            WhatsApp&apos;a dön
          </a>
        </div>
      </div>
    );
  }

  if (state === "saved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7" strokeWidth={2.4} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Kaydedildi</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Market profiliniz güncellendi.</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition active:scale-95"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="px-1">
          <BackButton />
        </div>

        <HeroBanner
          Icon={User}
          title="Profilim"
          subtitle="Market bilgilerinizi düzenleyin."
        />

        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-sm space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Adınız</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
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
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="ABC Market"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sektör</label>
            <div className="space-y-1.5">
              {SEKTOR_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
                  <input
                    type="radio"
                    name="sektor"
                    value={opt.value}
                    checked={sektor === opt.value}
                    onChange={(e) => setSektor(e.target.value)}
                    className="text-emerald-600 focus:ring-emerald-400"
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
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
                  <input
                    type="radio"
                    name="urun_sayisi"
                    value={opt.value}
                    checked={urunSayisi === opt.value}
                    onChange={(e) => setUrunSayisi(e.target.value)}
                    className="text-emerald-600 focus:ring-emerald-400"
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
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none resize-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="Den Haag, Hollanda"
            />
          </div>

          <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
            <input
              type="checkbox"
              checked={briefingEnabled}
              onChange={(e) => setBriefingEnabled(e.target.checked)}
              className="mt-0.5 text-emerald-600 focus:ring-emerald-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Sabah günlük brifing göndersin (dünkü ciro, kritik stok, vade durumu).
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-3 rounded-lg text-sm font-semibold transition active:scale-[0.98]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={state === "saving"}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50 active:scale-[0.98]"
            >
              {state === "saving" ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
