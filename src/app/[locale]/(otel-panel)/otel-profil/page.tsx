"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, User, Building2 } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface InitData {
  displayName: string | null;
  officeName: string | null;
}

export default function OtelProfilPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [data, setData] = useState<InitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`/api/otel-panel/init?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error) setData({ displayName: d.displayName, officeName: d.officeName }); })
      .catch(() => { /* layout zaten error gösterdi */ })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Profilim"
        subtitle="Otel ve kişisel bilgilerinizi buradan yöneteceksiniz."
        Icon={Settings}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton height="h-20" />
          <Skeleton height="h-20" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Sahip</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{data?.displayName || "—"}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Otel</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{data?.officeName || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Düzenleme yakında</p>
        <p>
          Otel adı, lokasyon, kontak bilgileri, çek-in/çek-out saatleri, Wi-Fi tercihleri buradan düzenlenebilecek. Şimdilik WhatsApp&apos;tan size yardımcı olabilirim.
        </p>
      </div>
    </div>
  );
}
