"use client";

/**
 * /tr/bayi-davetleri — Dağıtıcı davet listesi (3 sekme).
 *
 * Sekmeler: Bekleyen / Kabul Edilen / Süresi Dolmuş.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Clock, CheckCircle2, XCircle, Copy, MessageCircle, Smartphone, Check } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Row {
  id: string;
  phone: string;
  name: string;
  store_name: string;
  store_address: string | null;
  status: string;
  invite_code: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  daysLeft: number;
}

type TabKey = "pending" | "accepted" | "expired";

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Clock }> = [
  { key: "pending",  label: "Bekleyen",       Icon: Clock },
  { key: "accepted", label: "Kabul Edilen",   Icon: CheckCircle2 },
  { key: "expired",  label: "Süresi Dolmuş",  Icon: XCircle },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

function buildShareMessage(row: Row, distributorName: string, acceptUrl: string): string {
  return (
    `Merhaba ${row.name}, ${distributorName} sizi UPU sistemine davet etti. ` +
    `Mağaza: ${row.store_name}. Hesabınızı aktifleştirmek için: ${acceptUrl} (7 gün geçerli).`
  );
}

export default function BayiDavetleriPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [tab, setTab] = useState<TabKey>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [distributorName, setDistributorName] = useState("Dağıtıcınız");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bayi-davet/list?status=${tab}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        setRows(d.rows || []);
        if (d.distributor_name) setDistributorName(d.distributor_name);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [tab]);

  function acceptUrlOf(code: string): string {
    if (typeof window !== "undefined") return `${window.location.origin}/tr/davet/${code}`;
    return `/tr/davet/${code}`;
  }

  async function handleCopy(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* sessiz */
    }
  }

  function handleWhatsApp(phone: string, message: string) {
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
  }

  function handleSms(phone: string, message: string) {
    window.location.href = `sms:+${phone}?body=${encodeURIComponent(message)}`;
  }

  const newInviteHref = token ? `/tr/bayiler?t=${encodeURIComponent(token)}` : "/tr/bayiler";

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Mail}
        title="Davet Listesi"
        subtitle="Bayi davetlerinin durumunu buradan takip edin."
        ctaLabel="+ Yeni Davet"
        ctaHref={newInviteHref}
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300"
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Bu sekmede kayıt yok.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const acceptUrl = acceptUrlOf(r.invite_code);
            const message = buildShareMessage(r, distributorName, acceptUrl);
            const isCopied = copiedId === r.id;
            return (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {r.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {r.invite_code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      🏪 {r.store_name} · 📞 {r.phone}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Gönderildi: {formatDate(r.created_at)}
                      {tab === "pending" && r.daysLeft >= 0 && (
                        <span> · {r.daysLeft} gün kaldı</span>
                      )}
                      {tab === "accepted" && r.accepted_at && (
                        <span> · Kabul: {formatDate(r.accepted_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {tab === "pending" && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(r.id, acceptUrl)}
                      className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 active:scale-95 transition rounded-lg py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.2} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
                      )}
                      <span>{isCopied ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWhatsApp(r.phone, message)}
                      className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition rounded-lg py-2 text-xs font-medium text-white"
                    >
                      <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.2} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSms(r.phone, message)}
                      className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded-lg py-2 text-xs font-medium text-white"
                    >
                      <Smartphone className="w-3.5 h-3.5" strokeWidth={2.2} />
                      <span>SMS</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
