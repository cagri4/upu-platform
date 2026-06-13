"use client";

/**
 * /tr/otel-konuklar — Lifetime misafir profilleri (banking style).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Users, Mail, Phone, Calendar, ChevronRight } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Guest {
  id: string;
  display_name: string | null;
  whatsapp_phone: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function OtelKonuklarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [list, setList] = useState<Guest[] | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/list-guests?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.guests) setList(d.guests); })
      .catch(() => setList([]));
  }, [token]);

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Müşteriler"
        subtitle={
          list === null
            ? "Yüklüyoruz…"
            : `${list.length} lifetime kayıt — yıllar sonra dönen misafir aynı profili korur, doğum günü/sezon kampanyası taslakları için temel.`
        }
        Icon={Users}
      />

      {list === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
        </div>
      )}

      {list?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Henüz müşteri kaydı yok. WhatsApp&apos;ta <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">misafirdavet &lt;telefon&gt;</span> komutuyla davet gönderdiğinizde otomatik kayıt oluşur.
          </p>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="space-y-2">
          {list.map((g) => {
            const meta = g.metadata || {};
            const optIn = meta.marketing_opt_in === true;
            const date = new Date(g.created_at).toLocaleDateString("tr-TR");
            const detailHref = `/tr/otel-konuklar/${g.id}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
            return (
              <Link
                key={g.id}
                href={detailHref}
                className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{g.display_name || "Misafir"}</span>
                      {optIn && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" title="Pazarlama mesajı için opt-in">
                          <Mail className="w-3 h-3" /> Opt-in
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                      {g.whatsapp_phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {g.whatsapp_phone}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> İlk kayıt: {date}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
