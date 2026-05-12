"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  Presentation,
  Pencil,
  Trash2,
  Home,
  AlertTriangle,
} from "lucide-react";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";
import { ReturnButtons } from "@/components/return-buttons";
import { Skeleton } from "@/components/banking";

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
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<PropItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter((p) =>
      (p.title || "").toLocaleLowerCase("tr").includes(q) ||
      (p.location || "").toLocaleLowerCase("tr").includes(q) ||
      (p.listing_type || "").toLocaleLowerCase("tr").includes(q) ||
      (p.type || "").toLocaleLowerCase("tr").includes(q),
    );
  }, [items, searchQuery]);

  useEffect(() => {
    fetch(`/api/mulklerim/init?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setItems(d.properties || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

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

  if (status === "loading") {
    return (
      <div className="space-y-5 pb-24">
        <Skeleton height="h-9" className="w-1/2" />
        <Skeleton height="h-14" />
        <Skeleton height="h-12" />
        <Skeleton height="h-28" />
        <Skeleton height="h-28" />
        <Skeleton height="h-28" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={whatsappDeeplink(BOT_WA_NUMBER)}
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }

  return (
    <div className="pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mülklerim</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {items.length} kayıt
        </span>
      </div>

      {/* Primary action — fresh-mint magic link via /api/panel/start (cookie-aware) */}
      <a
        href={`/api/panel/start?cmd=mulkekle&t=${encodeURIComponent(token || "")}`}
        className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Mülk Ekle
      </a>

      {items.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Mülk ara (başlık, bölge, tip)"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-sm"
            aria-label="Mülk ara"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Building2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz mülk yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">İlk mülkünüzü eklemek için yukarıdaki butonu kullanın.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Eşleşen mülk bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 overflow-hidden"
            >
              <div className="flex gap-3 p-3">
                <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <Home className="w-7 h-7 text-slate-400 dark:text-slate-500" strokeWidth={1.8} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2">
                    {p.title || "Mülk"}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-2">
                    {p.listing_type && (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {p.listing_type === "satilik" ? "Satılık" : "Kiralık"}
                      </span>
                    )}
                    {p.rooms && <span>{p.rooms}</span>}
                    {p.area && <span>{p.area}m²</span>}
                  </div>
                  {p.price !== null && p.price > 0 && (
                    <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm">
                      {new Intl.NumberFormat("tr-TR").format(p.price)} ₺
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-3">
                {p.sunum_token ? (
                  <a
                    href={`/d/p/${p.sunum_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:bg-emerald-100 transition"
                  >
                    <Presentation className="w-4 h-4" strokeWidth={2.2} />
                    Sunum
                  </a>
                ) : (
                  <span className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed">
                    <Presentation className="w-4 h-4" strokeWidth={2.2} />
                    Yok
                  </span>
                )}
                <a
                  href={`/tr/mulkekle-form?id=${p.id}&t=${token || ""}`}
                  className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition border-l border-slate-100 dark:border-slate-800"
                >
                  <Pencil className="w-4 h-4" strokeWidth={2.2} />
                  Düzenle
                </a>
                <button
                  onClick={() => void handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition border-l border-slate-100 dark:border-slate-800 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                  {deletingId === p.id ? "..." : "Sil"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReturnButtons
        token={token}
        botPhone={BOT_WA_NUMBER}
        onWaReturn={async () => {
          try {
            await fetch("/api/mulklerim/finish", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
          } catch { /* devam mesajı server'dan after() ile gider */ }
        }}
      />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}
