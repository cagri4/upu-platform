"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Home,
  UserCircle2,
  CheckCircle2,
  Clock,
  Download,
  Share2,
  Copy,
  Check,
  Trash2,
  FileText,
  Signature,
  Percent,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

interface ContractData {
  property_title?: string;
  property_address?: string;
  property_type?: string;
  listing_type?: string;
  owner_name?: string;
  owner_phone?: string;
  exclusive?: boolean;
  commission?: number;
  duration?: number;
  generated_text?: string;
}

interface Contract {
  id: string;
  type: string;
  status: string;
  contract_data: ContractData;
  sign_token: string | null;
  signed_at: string | null;
  created_at: string;
  owner_signature_url: string | null;
}

type Status = "loading" | "ready" | "deleting" | "error";

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-900 dark:text-white mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-slate-900 dark:text-white mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">$1</h3>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  return html;
}

export default function ContractDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [contract, setContract] = useState<Contract | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) { setStatus("error"); setError("Sözleşme bulunamadı."); return; }
    const tokenQs = token ? `&t=${encodeURIComponent(token)}` : "";
    fetch(`/api/sozlesmelerim/get?id=${encodeURIComponent(id)}${tokenQs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
        setContract(d.contract);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token, id]);

  function downloadPdf() {
    const tokenQs = token ? `&t=${encodeURIComponent(token)}` : "";
    window.open(`/api/sozlesmelerim/pdf?id=${encodeURIComponent(id)}${tokenQs}`, "_blank");
  }

  function copySignLink() {
    if (!contract?.sign_token) return;
    const link = `${APP_URL}/tr/sign/${contract.sign_token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handleDelete() {
    if (!confirm("Bu sözleşmeyi silmek istediğinize emin misiniz? Listeden kaldırılır.")) return;
    setStatus("deleting");
    try {
      const res = await fetch("/api/sozlesmelerim/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(token ? { token, id } : { id }),
      });
      if (!res.ok) {
        const d = await res.json();
        setStatus("ready");
        setError(d.error || "Silinemedi.");
        return;
      }
      const back = token ? `/tr/sozlesmelerim?t=${encodeURIComponent(token)}` : `/tr/sozlesmelerim`;
      router.push(back);
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  const backHref = token ? `/tr/sozlesmelerim?t=${encodeURIComponent(token)}` : `/tr/sozlesmelerim`;

  if (status === "loading") {
    return <LoadingState variant="card" />;
  }
  if (status === "error" || !contract) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Sözleşmelerim
        </a>
      </div>
    );
  }

  const cd = contract.contract_data || {};
  const ownerName = cd.owner_name || "İsimsiz";
  const propTitle = cd.property_title || cd.property_address || "Mülk";
  const isSigned = !!contract.signed_at;
  const StatusIcon = isSigned ? CheckCircle2 : Clock;
  const statusLabel = isSigned ? "İmzalı" : "İmza bekliyor";
  const statusClasses = isSigned
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400";
  const createdDate = new Date(contract.created_at).toLocaleString("tr-TR");
  const signedDate = contract.signed_at ? new Date(contract.signed_at).toLocaleString("tr-TR") : null;
  const generatedText = cd.generated_text;

  return (
    <div className="space-y-5 pb-24">
      {/* Sticky back bar — banking style */}
      <div className="flex items-center gap-3">
        <a
          href={backHref}
          className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
        </a>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex-1 truncate">Sözleşme</h1>
        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap flex items-center gap-1.5 ${statusClasses}`}>
          <StatusIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
          {statusLabel}
        </span>
      </div>

      {/* Property + owner card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Home className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Mülk</p>
            <p className="font-semibold text-slate-900 dark:text-white truncate">{propTitle}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCircle2 className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Mülk Sahibi</p>
            <p className="font-semibold text-slate-900 dark:text-white truncate">{ownerName}</p>
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Bilgiler
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat Icon={Percent} label="Komisyon" value={`%${cd.commission ?? 2} + KDV`} />
          <Stat Icon={Calendar} label="Süre" value={`${cd.duration ?? 3} ay`} />
          <Stat Icon={Signature} label="Münhasır" value={cd.exclusive ? "Evet" : "Hayır"} />
          <Stat Icon={Clock} label="Oluşturuldu" value={createdDate} />
          {signedDate && (
            <div className="col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Stat Icon={CheckCircle2} label="İmza tarihi" value={signedDate} accent />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={downloadPdf}
          className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
        >
          <Download className="w-4 h-4" strokeWidth={2.2} />
          PDF
        </button>
        <button
          onClick={copySignLink}
          disabled={!contract.sign_token}
          className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-2xl font-semibold text-sm active:scale-[0.98] transition"
        >
          {copied ? (
            <><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} /> Kopyalandı</>
          ) : (
            <><Share2 className="w-4 h-4" strokeWidth={2.2} /> Paylaş</>
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={status === "deleting"}
          className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 py-3 rounded-2xl font-semibold text-sm active:scale-[0.98] transition"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2.2} />
          {status === "deleting" ? "..." : "Sil"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
        </div>
      )}

      {/* Sözleşme metni */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          Sözleşme Metni
        </h2>
        {generatedText ? (
          <div
            className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }}
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Bu sözleşme AI üretiminden önce oluşturulmuş — tam metin yok. Yukarıdaki bilgiler özet niteliğinde.
          </p>
        )}
      </div>

      {/* İmza görseli */}
      {contract.owner_signature_url && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Signature className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
            Müşteri İmzası
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contract.owner_signature_url}
            alt="İmza"
            className="max-w-full h-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">{ownerName} — {signedDate}</p>
        </div>
      )}

      {/* Geri */}
      <a
        href={backHref}
        className="flex items-center justify-center gap-1.5 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Sözleşmelerime Dön
      </a>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  accent = false,
}: {
  Icon: typeof Percent;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
        }`}
        strokeWidth={2.2}
      />
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p
          className={`text-sm font-semibold ${
            accent ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
