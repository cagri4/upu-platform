"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
        <span className="text-xs text-slate-500">{list?.length ?? "—"} lifetime kayıt</span>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
        💡 Müşterileriniz silinmez — yıllar sonra dönen müsafir aynı profili korur. Doğum günü / sezon kampanyası mesaj taslakları için temel.
      </div>

      {list === null && <div className="text-sm text-slate-500">⏳ Yükleniyor...</div>}
      {list?.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-600 shadow-sm">
          Henüz müşteri kaydı yok. WhatsApp&apos;ta <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">misafirdavet &lt;telefon&gt;</span> komutuyla davet gönderdiğinizde otomatik kayıt oluşur.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {list.map((g) => {
              const meta = g.metadata || {};
              const optIn = meta.marketing_opt_in === true;
              const date = new Date(g.created_at).toLocaleDateString("tr-TR");
              return (
                <li key={g.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900 truncate">{g.display_name || "Misafir"}</span>
                        {optIn && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700" title="Pazarlama mesajı için opt-in verdi">✉️ Opt-in</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                        {g.whatsapp_phone && <span>📱 {g.whatsapp_phone}</span>}
                        <span>📅 İlk kayıt: {date}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
