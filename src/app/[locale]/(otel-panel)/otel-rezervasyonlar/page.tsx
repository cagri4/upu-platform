"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Reservation {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  status: string | null;
  total_price: number | null;
  source: string | null;
  pre_checkin_complete: boolean | null;
  otel_rooms: { name?: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  confirmed:    { label: "Onaylı",       color: "bg-emerald-100 text-emerald-800" },
  checked_in:   { label: "Konaklamada",  color: "bg-cyan-100 text-cyan-800" },
  checked_out:  { label: "Çıktı",        color: "bg-slate-100 text-slate-700" },
  pending:      { label: "Beklemede",    color: "bg-amber-100 text-amber-800" },
  cancelled:    { label: "İptal",        color: "bg-rose-100 text-rose-700" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

export default function OtelRezervasyonlarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [list, setList] = useState<Reservation[] | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/list-reservations?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error && d?.reservations) setList(d.reservations); })
      .catch(() => setList([]));
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Rezervasyonlar</h1>
        <span className="text-xs text-slate-500">{list?.length ?? "—"} kayıt</span>
      </div>

      {list === null && <div className="text-sm text-slate-500">⏳ Yükleniyor...</div>}
      {list?.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-600 shadow-sm">
          Henüz rezervasyon yok. WhatsApp&apos;ta <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">rezervasyonekle</span> komutuyla ekleyebilirsiniz.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {list.map((r) => {
              const status = STATUS_LABEL[r.status || ""] || { label: r.status || "—", color: "bg-slate-100 text-slate-700" };
              const room = r.otel_rooms?.name || "—";
              return (
                <li key={r.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900 truncate">{r.guest_name || "—"}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
                        {r.pre_checkin_complete && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700" title="Online çek-in tamam">📝✓</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                        <span>📅 {fmtDate(r.check_in)} → {fmtDate(r.check_out)}</span>
                        <span>🚪 Oda {room}</span>
                        {r.guest_phone && <span>📱 {r.guest_phone}</span>}
                        {r.source && <span className="text-slate-400">via {r.source}</span>}
                      </div>
                    </div>
                    {r.total_price !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-slate-900">{Number(r.total_price).toLocaleString("tr-TR")} ₺</div>
                      </div>
                    )}
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
