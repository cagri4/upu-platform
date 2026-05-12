"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Plus,
  Home,
  UserCircle2,
  CheckCircle2,
  Clock,
  FileClock,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
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

interface StatusVisual {
  label: string;
  Icon: typeof CheckCircle2;
  bg: string;
}

function statusVisual(s: string): StatusVisual {
  if (s === "signed") {
    return {
      label: "İmzalı",
      Icon: CheckCircle2,
      bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    };
  }
  if (s === "pending_signature") {
    return {
      label: "İmza bekliyor",
      Icon: Clock,
      bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    };
  }
  return {
    label: "Taslak",
    Icon: FileClock,
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  };
}

export default function SozlesmelerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Contract[]>([]);

  useEffect(() => {
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
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sözleşmelerim</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {items.length} kayıt
        </span>
      </div>

      <a
        href={`/tr/sozlesme-yap?t=${encodeURIComponent(token)}`}
        className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Sözleşme Yap
      </a>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <FileText className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz sözleşme eklemediniz</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">İlk sözleşmenizi oluşturmak için yukarıdaki butonu kullanın.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const cd = c.contract_data || {};
            const ownerName = (cd.owner_name as string) || "İsimsiz";
            const propTitle = (cd.property_title as string) || (cd.property_address as string) || "Mülk";
            const sv = statusVisual(c.status);
            const date = new Date(c.created_at).toLocaleDateString("tr-TR");
            const commission = cd.commission as number | undefined;
            const duration = cd.duration as number | undefined;
            return (
              <a
                key={c.id}
                href={`/tr/sozlesmelerim/${c.id}?t=${encodeURIComponent(token)}`}
                className="block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="p-4 flex gap-3 items-start">
                  <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" strokeWidth={2} />
                          {propTitle}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                          <UserCircle2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" strokeWidth={2} />
                          {ownerName}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap flex items-center gap-1 ${sv.bg}`}>
                        <sv.Icon className="w-3 h-3" strokeWidth={2.2} />
                        {sv.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {commission !== undefined && <span>%{commission}+KDV</span>}
                      {duration !== undefined && <span>{duration} ay</span>}
                      <span>{date}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0 self-center" />
                </div>
              </a>
            );
          })}
        </div>
      )}

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}
