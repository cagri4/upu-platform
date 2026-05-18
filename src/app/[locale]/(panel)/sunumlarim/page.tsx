"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Presentation,
  Home,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

import { ReturnButtons } from "@/components/return-buttons";
import { Skeleton } from "@/components/banking";

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
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<PresItem[]>([]);

  useEffect(() => {
    fetch(`/api/sunumlarim/init?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setItems(d.presentations || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="space-y-5 pb-24">
        <Skeleton height="h-9" className="w-1/2" />
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
          href={`https://wa.me/${BOT_WA_NUMBER}`}
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sunumlarım</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {items.length} kayıt
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Presentation className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz sunumunuz yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Bir mülk eklediğinizde sizin için hemen sunum oluştururum.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <a
              key={p.id}
              href={`/d/p/${p.magic_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 hover:shadow-md active:scale-[0.99] transition"
            >
              <div className="flex gap-3 p-3 items-center">
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
                    {p.title || "Sunum"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(p.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {p.price && (
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {new Intl.NumberFormat("tr-TR").format(p.price)} ₺
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      )}

      <ReturnButtons token={token} botPhone={BOT_WA_NUMBER} />
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
