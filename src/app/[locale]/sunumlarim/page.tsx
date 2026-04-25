"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

interface PresItem {
  id: string;
  title: string;
  magic_token: string;
  created_at: string;
  cover: string | null;
  price: number | null;
}

type Status = "loading" | "ready" | "error";

export default function SunumlarimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<PresItem[]>([]);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/sunumlarim/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setItems(d.presentations || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📚</div>
          <h1 className="text-xl font-bold">Sunumlarım</h1>
          <p className="text-blue-100 text-sm mt-1">{items.length} sunum</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm shadow-sm">
            Henüz hiç sunumunuz yok. WhatsApp&apos;tan bir mülk ekleyince otomatik sunum oluşur.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <a
                key={p.id}
                href={`/d/p/${p.magic_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition"
              >
                <div className="flex gap-3 p-3">
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                    {p.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        🏠
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{p.title || "Sunum"}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(p.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {p.price && (
                      <p className="text-sm font-bold text-indigo-700 mt-1">
                        {new Intl.NumberFormat("tr-TR").format(p.price)} ₺
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-slate-400">
                    →
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="block mt-6 bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg text-center active:scale-95"
        >
          💬 WhatsApp&apos;a Dön
        </a>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
