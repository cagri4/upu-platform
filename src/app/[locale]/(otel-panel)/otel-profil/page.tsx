"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface InitData {
  displayName: string | null;
  officeName: string | null;
}

export default function OtelProfilPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [data, setData] = useState<InitData | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/init?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error) setData({ displayName: d.displayName, officeName: d.officeName }); })
      .catch(() => { /* layout zaten error gösterdi */ });
  }, [token]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Profilim</h1>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm space-y-3 text-sm">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sahip</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{data?.displayName || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Otel</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{data?.officeName || "—"}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Düzenleme yakında</p>
        <p>
          Otel adı, lokasyon, kontak bilgileri, çek-in/çek-out saatleri, Wi-Fi tercihleri buradan düzenlenebilecek. Şimdilik WhatsApp&apos;tan size yardımcı olabilirim.
        </p>
      </div>
    </div>
  );
}
