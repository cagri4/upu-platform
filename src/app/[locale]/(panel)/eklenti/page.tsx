"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>⚠️ {error}</Center>;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">🧩</div>
        <h1 className="text-xl font-bold">Chrome Eklentisi Bağlantı Kodu</h1>
        <p className="text-amber-100 text-sm mt-1">
          Sahibinden.com&apos;a otomatik form doldurma için eklentinizi panelinize bağlayın.
        </p>
      </div>

      {/* Big code box */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
          Bağlantı Kodunuz
        </p>
        <div className="bg-slate-900 text-white text-4xl md:text-5xl font-mono font-black tracking-widest text-center py-6 rounded-xl mb-4 select-all">
          {code || "—"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void copyCode()}
            className="bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95"
          >
            {copied ? "✅ Kopyalandı" : "📋 Kopyala"}
          </button>
          <button
            onClick={() => void regenerate()}
            disabled={status === "regenerating"}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-medium disabled:opacity-60"
          >
            {status === "regenerating" ? "..." : "🔄 Yeni Kod Üret"}
          </button>
        </div>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">⚠️ {error}</div>
        )}
      </div>

      {/* Tutorial */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-900 mb-3">📋 Kurulum Adımları</p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 text-base">1️⃣</span>
            <div className="flex-1">
              <p className="font-medium text-slate-900">Chrome Web Store&apos;dan eklentiyi yükle</p>
              <a
                href={EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-xs text-amber-700 underline break-all"
              >
                🧩 UPU Sahibinden Form Doldurucu →
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 text-base">2️⃣</span>
            <div className="flex-1">
              <p className="font-medium text-slate-900">Chrome&apos;da eklenti ikonuna tıkla</p>
              <p className="text-xs text-slate-500 mt-0.5">Sağ üstte yeni eklenti simgesi (🧩) gözükür.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 text-base">3️⃣</span>
            <div className="flex-1">
              <p className="font-medium text-slate-900">Yukarıdaki kodu yapıştır</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Eklenti penceresinde &quot;Bağlantı Kodu&quot; alanına <span className="font-mono font-semibold text-slate-700">{code}</span> kodunu girip Bağlan&apos;a basın.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 text-base">4️⃣</span>
            <div className="flex-1">
              <p className="font-medium text-slate-900">sahibinden.com/ilan-ver&apos;e gidin</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Eklenti üstte gözükür → mülkünüzü seçin → form 30 saniyede dolar.
              </p>
            </div>
          </li>
        </ol>
        <p className="text-xs text-slate-500 mt-4 italic">
          🔒 Bağlantı kodunuz size özeldir. Başkalarıyla paylaşmayın.
        </p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
