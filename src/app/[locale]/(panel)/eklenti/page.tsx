"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Puzzle,
  Copy,
  Check,
  RotateCw,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Lock,
  ClipboardList,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

const EXTENSION_URL = "https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe";

type Status = "loading" | "ready" | "regenerating" | "error";

export default function EklentiPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/extension/get-or-create-code${tokenQs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setCode(d.code);
      setStatus("ready");
    } catch {
      setStatus("error");
      setError("Bağlantı hatası.");
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }

  async function regenerate() {
    if (!confirm("Yeni kod üretilecek — eskisi çalışmayacak ve eklentiyi yeniden bağlamanız gerekecek. Onaylıyor musunuz?")) return;
    setStatus("regenerating");
    setError("");
    try {
      const r = await fetch("/api/extension/get-or-create-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, regenerate: true }),
      });
      const d = await r.json();
      if (!r.ok) { setStatus("ready"); setError(d.error || "Üretilemedi."); return; }
      setCode(d.code);
      setStatus("ready");
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <LoadingState />;
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  const steps: Array<{ title: string; desc: React.ReactNode; link?: { url: string; label: string } }> = [
    {
      title: "Chrome Web Store'dan eklentiyi yükle",
      desc: "UPU Sahibinden Form Doldurucu eklentisini Chrome'a ekleyin.",
      link: { url: EXTENSION_URL, label: "Eklenti sayfasını aç" },
    },
    {
      title: "Chrome'da eklenti ikonuna tıkla",
      desc: "Sağ üstte yeni eklenti simgesi görünecek.",
    },
    {
      title: "Yukarıdaki kodu yapıştır",
      desc: (
        <>
          Eklenti penceresinde &quot;Bağlantı Kodu&quot; alanına{" "}
          <span className="font-mono font-semibold text-slate-900 dark:text-white">{code}</span>{" "}
          kodunu girip Bağlan&apos;a basın.
        </>
      ),
    },
    {
      title: "sahibinden.com/ilan-ver'e gidin",
      desc: "Eklenti üstte gözükür → mülkünüzü seçin → form 30 saniyede dolar.",
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Hero — sade banking */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Eklenti Bağlantısı</h1>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        Sahibinden.com&apos;da otomatik form doldurma için eklentinizi panelinize bağlayın.
      </p>

      {/* Code box — slate-900 mono banking */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 text-center">
          Bağlantı Kodunuz
        </p>
        <div className="bg-slate-900 dark:bg-slate-950 text-white text-4xl md:text-5xl font-mono font-bold tracking-widest text-center py-6 rounded-xl mb-4 select-all border border-slate-800">
          {code || "—"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void copyCode()}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
          >
            {copied ? (
              <><Check className="w-4 h-4" strokeWidth={2.5} /> Kopyalandı</>
            ) : (
              <><Copy className="w-4 h-4" strokeWidth={2.2} /> Kopyala</>
            )}
          </button>
          <button
            onClick={() => void regenerate()}
            disabled={status === "regenerating"}
            className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium disabled:opacity-60 active:scale-[0.98] transition"
          >
            {status === "regenerating" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
            ) : (
              <><RotateCw className="w-4 h-4" strokeWidth={2.2} /> Yeni Kod</>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
          </div>
        )}
      </div>

      {/* Tutorial */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          Kurulum Adımları
        </h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-white">{s.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
                {s.link && (
                  <a
                    href={s.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                  >
                    <Puzzle className="w-3.5 h-3.5" strokeWidth={2.2} /> {s.link.label}
                    <ExternalLink className="w-3 h-3" strokeWidth={2.2} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-5 flex items-center gap-1.5 italic">
          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          Bağlantı kodunuz size özeldir. Başkalarıyla paylaşmayın.
        </p>
      </div>
    </div>
  );
}
