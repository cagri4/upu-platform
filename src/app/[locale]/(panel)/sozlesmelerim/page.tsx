"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReturnButtons } from "@/components/return-buttons";

const BOT_WA_NUMBER = "31644967207";
interface Contract {
  id: string;
  status: string;
  contract_data: Record<string, unknown>;
  sign_token: string | null;
  signed_at: string | null;
  created_at: string;
}

type Status = "loading" | "ready" | "error";

export default function SozlesmelerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Contract[]>([]);

  useEffect(() => {
    // cookie-aware: token yoksa endpoint cookie session kabul eder
    fetch(`/api/sozlesmelerim/list?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
        setItems(d.contracts || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") {
    return <div className="text-center py-20"><div className="text-4xl">⏳</div></div>;
  }
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">📋</div>
        <h1 className="text-xl font-bold">Sözleşmelerim</h1>
        <p className="text-amber-200 text-sm mt-1">{items.length} sözleşme</p>
      </div>

      {/* Primary action — panel-içi sözleşme akışı */}
      <a
        href={`/tr/sozlesme-yap?t=${encodeURIComponent(token)}`}
        className="block bg-gradient-to-r from-amber-600 to-orange-600 text-white text-center font-semibold py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition"
      >
        ➕ Sözleşme Yap
      </a>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Henüz sözleşme eklemediniz</p>
          <p className="text-slate-500 text-sm">İlk sözleşmenizi oluşturmak için yukarıdaki butonu kullanın.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const cd = c.contract_data || {};
            const ownerName = (cd.owner_name as string) || "İsimsiz";
            const propTitle = (cd.property_title as string) || (cd.property_address as string) || "Mülk";
            const statusLabel = c.status === "signed" ? "✅ İmzalı" : c.status === "pending_signature" ? "⏳ İmza bekliyor" : "📝 Taslak";
            const statusBg = c.status === "signed" ? "bg-emerald-100 text-emerald-700" : c.status === "pending_signature" ? "bg-amber-100 text-amber-700" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400";
            const date = new Date(c.created_at).toLocaleDateString("tr-TR");
            const commission = cd.commission as number | undefined;
            const duration = cd.duration as number | undefined;
            return (
              <div key={c.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">🏠 {propTitle}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">👤 {ownerName}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusBg}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {commission !== undefined && <span>💰 %{commission}+KDV</span>}
                    {duration !== undefined && <span>📅 {duration} ay</span>}
                    <span>· {date}</span>
                  </div>
                </div>
                <a
                  href={`/tr/sozlesmelerim/${c.id}?t=${encodeURIComponent(token)}`}
                  className="block py-3 text-center text-sm font-medium text-amber-700 hover:bg-amber-50 active:bg-amber-100 transition border-t border-slate-100"
                >
                  📄 İncele →
                </a>
              </div>
            );
          })}
        </div>
      )}

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}
