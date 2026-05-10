"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { YARDIM_ENTRIES } from "@/lib/yardim-content";

type Status = "loading" | "ready" | "error";

export default function YardimIndexPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("ready"); return; } // Token zorunlu değil — public sayfa
    fetch(`/api/yardim/init?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) { const d = await r.json(); setError(d.error || "Link doğrulanamadı."); setStatus("error"); return; }
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center><div className="text-red-600">⚠️ {error}</div></Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">❓</div>
          <h1 className="text-xl font-bold">Yardım Merkezi</h1>
          <p className="text-emerald-200 text-sm mt-1">Komutları nasıl kullanacağını adım adım öğren.</p>
        </div>

        <div className="space-y-2">
          {YARDIM_ENTRIES.map((e) => (
            <a
              key={e.command}
              href={`/tr/yardim/${e.command}${token ? `?t=${token}` : ""}`}
              className="block bg-white rounded-2xl shadow-sm p-4 hover:bg-slate-100 active:scale-95 transition"
            >
              <div className="font-semibold text-slate-900">{e.title}</div>
              <div className="text-xs text-slate-500 mt-1">{e.summary}</div>
              <div className="text-xs text-emerald-700 mt-2">WhatsApp: <span className="font-mono">{e.waCommand}</span> →</div>
            </a>
          ))}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Yardım sayfasında olmayan bir komut hakkında yardım gerek? *menü* yaz, listeyi gör.
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
