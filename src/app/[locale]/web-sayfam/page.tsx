"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

interface Data {
  ready: boolean;
  slug?: string;
  full_name?: string;
  photo_url?: string | null;
  property_count?: number;
  message?: string;
}

type Status = "loading" | "ready" | "error" | "not-ready";

export default function WebSayfamPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/websayfam/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        if (!d.ready) { setStatus("not-ready"); setError(d.message || "Profil eksik."); return; }
        setData(d);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  const fullUrl = data?.slug
    ? (typeof window !== "undefined" ? `${window.location.origin}/u/${data.slug}` : `https://estateai.upudev.nl/u/${data.slug}`)
    : "";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function shareWA() {
    const text = encodeURIComponent(`Kişisel emlak portföyüm: ${fullUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const res = await fetch("/api/websayfam/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json().catch(() => ({}));
      const waUrl = (d?.wa_url as string) || `https://wa.me/${BOT_WA_NUMBER}`;
      window.location.href = waUrl;
    } catch {
      window.location.href = `https://wa.me/${BOT_WA_NUMBER}`;
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;
  if (status === "not-ready") return <Center>
    <div className="text-4xl mb-3">🪪</div>
    <h1 className="text-xl font-bold mb-2">Profil eksik</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-violet-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-fuchsia-600 to-rose-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🌐</div>
          <h1 className="text-xl font-bold">Web Sayfam</h1>
          <p className="text-fuchsia-100 text-sm mt-1">{data?.full_name} · {data?.property_count} aktif mülk</p>
        </div>

        {/* URL display */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Sayfa Adresiniz</p>
          <div className="bg-slate-100 rounded-lg p-3 break-all text-sm font-mono text-slate-800 mb-3">
            {fullUrl}
          </div>
          <button
            onClick={() => void copyUrl()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-medium text-sm"
          >
            {copied ? "✅ Kopyalandı!" : "🔗 Linki Kopyala"}
          </button>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <a
            href={`/u/${data?.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-fuchsia-600 hover:bg-fuchsia-700 text-white py-4 rounded-xl font-semibold text-base shadow text-center active:scale-95"
          >
            👀 Sayfayı Önizle
          </a>
          <button
            onClick={shareWA}
            className="block w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold text-base shadow text-center active:scale-95"
          >
            💬 WhatsApp&apos;ta Paylaş
          </button>
          <a
            href={`/tr/profil-duzenle?t=${token || ""}`}
            className="block bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium text-sm text-center active:scale-95"
          >
            ✏️ Profil bilgilerini düzenle
          </a>
        </div>

        <button
          onClick={() => void handleFinish()}
          disabled={finishing}
          className="block w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95 disabled:opacity-60"
        >
          {finishing ? "⏳ Yönlendiriliyor..." : "💬 WhatsApp'a Dön"}
        </button>
        <p className="text-xs text-slate-500 text-center mt-2 px-4">
          WhatsApp&apos;a döndüğünüzde sıradaki adım için yeni bir mesaj sizi bekliyor olacak.
        </p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
