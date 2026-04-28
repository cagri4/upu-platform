"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";

const BOT_WA_NUMBER = "31644967207";

interface PropItem {
  id: string;
  title: string;
  type: string | null;
  listing_type: string | null;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location: string | null;
  cover: string | null;
  status: string | null;
  created_at: string;
  sunum_token: string | null;
}

type Status = "loading" | "ready" | "error";

export default function MulklerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<PropItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/mulklerim/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setItems(d.properties || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handleFinish() {
    setFinishing(true);
    try {
      await fetch("/api/mulklerim/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      // chain devam mesajı server'dan after() ile gider; navigate yine de yap
    }
    window.location.href = whatsappDeeplink(BOT_WA_NUMBER);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu mülkü silmek istediğinize emin misiniz? Geri alabilmek için destek ile iletişime geçmeniz gerekir.")) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/mulklerim/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, property_id: id }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Silinemedi.");
      } else {
        setItems((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      alert("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  }

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
        <div className="bg-gradient-to-br from-stone-700 to-stone-900 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📁</div>
          <h1 className="text-xl font-bold">Mülklerim</h1>
          <p className="text-stone-300 text-sm mt-1">{items.length} mülk</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm shadow-sm">
            Henüz hiç mülk eklemediniz. WhatsApp&apos;tan &quot;Mülk Ekle&quot; komutunu kullanın.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                    {p.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">🏠</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">{p.title || "Mülk"}</h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                      {p.listing_type && <span>{p.listing_type === "satilik" ? "Satılık" : "Kiralık"}</span>}
                      {p.rooms && <span>{p.rooms}</span>}
                      {p.area && <span>{p.area}m²</span>}
                    </div>
                    {p.price && (
                      <p className="text-sm font-bold text-stone-900 mt-0.5">
                        {new Intl.NumberFormat("tr-TR").format(p.price)} ₺
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-100 grid grid-cols-3">
                  {p.sunum_token ? (
                    <a
                      href={`/d/p/${p.sunum_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition"
                    >
                      📊 Sunum
                    </a>
                  ) : (
                    <span className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-slate-400 cursor-not-allowed">
                      📊 Yok
                    </span>
                  )}
                  <a
                    href={`/tr/mulkekle-form?id=${p.id}&t=${token || ""}`}
                    className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 transition border-l border-slate-100"
                  >
                    ✏️ Düzenle
                  </a>
                  <button
                    onClick={() => void handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition border-l border-slate-100 disabled:opacity-50"
                  >
                    🗑️ {deletingId === p.id ? "Siliniyor..." : "Sil"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
