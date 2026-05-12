"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800/50">$1</h3>');
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

  if (status === "loading") {
    return <LoadingState variant="card" />;
  }
  if (status === "error" || !contract) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
        <a href={token ? `/tr/sozlesmelerim?t=${encodeURIComponent(token)}` : `/tr/sozlesmelerim`} className="inline-block mt-4 text-emerald-600 underline text-sm">
          ← Sözleşmelerim
        </a>
      </div>
    );
  }

  const cd = contract.contract_data || {};
  const ownerName = cd.owner_name || "İsimsiz";
  const propTitle = cd.property_title || cd.property_address || "Mülk";
  const isSigned = !!contract.signed_at;
  const statusBadge = isSigned ? "✅ İmzalı" : "⏳ İmza bekliyor";
  const statusBg = isSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  const createdDate = new Date(contract.created_at).toLocaleString("tr-TR");
  const signedDate = contract.signed_at ? new Date(contract.signed_at).toLocaleString("tr-TR") : null;
  const generatedText = cd.generated_text;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-3xl">📄</div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusBg}`}>
            {statusBadge}
          </span>
        </div>
        <h1 className="text-xl font-bold mt-1 truncate">{propTitle}</h1>
        <p className="text-amber-200 text-sm mt-1">👤 {ownerName}</p>
      </div>

      {/* Metadata */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-slate-500 font-semibold mb-2">📊 Bilgiler</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <p className="text-slate-500">Komisyon</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">%{cd.commission ?? 2} + KDV</p>
          </div>
          <div>
            <p className="text-slate-500">Süre</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{cd.duration ?? 3} ay</p>
          </div>
          <div>
            <p className="text-slate-500">Münhasır</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{cd.exclusive ? "Evet" : "Hayır"}</p>
          </div>
          <div>
            <p className="text-slate-500">Oluşturuldu</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{createdDate}</p>
          </div>
          {signedDate && (
            <div className="col-span-2">
              <p className="text-slate-500">İmza tarihi</p>
              <p className="font-semibold text-emerald-700">{signedDate}</p>
            </div>
          )}
        </div>
      </div>

      {/* Aksiyon butonları */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={downloadPdf}
          className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95 transition"
        >
          📄 PDF İndir
        </button>
        <button
          onClick={copySignLink}
          disabled={!contract.sign_token}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95 transition"
        >
          {copied ? "✅ Kopyalandı" : "🔗 Paylaş"}
        </button>
        <button
          onClick={handleDelete}
          disabled={status === "deleting"}
          className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold text-sm shadow active:scale-95 transition"
        >
          🗑 {status === "deleting" ? "..." : "Sil"}
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

      {/* Tam sözleşme metni */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-slate-500 font-semibold mb-3">📝 Sözleşme Metni</p>
        {generatedText ? (
          <div
            className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }}
          />
        ) : (
          <p className="text-sm text-slate-500 italic">
            Bu sözleşme AI üretiminden önce oluşturulmuş — tam metin yok. Yukarıdaki bilgiler özet niteliğinde.
          </p>
        )}
      </div>

      {/* İmza görseli */}
      {contract.owner_signature_url && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold mb-2">✍️ Müşteri İmzası</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={contract.owner_signature_url} alt="İmza" className="max-w-full h-auto border border-slate-200 dark:border-slate-800/50 rounded-lg" />
          <p className="text-xs text-slate-500 mt-2">{ownerName} — {signedDate}</p>
        </div>
      )}

      {/* Geri buton */}
      <a
        href={token ? `/tr/sozlesmelerim?t=${encodeURIComponent(token)}` : `/tr/sozlesmelerim`}
        className="block w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-medium text-center hover:bg-slate-50 transition"
      >
        ← Sözleşmelerime Dön
      </a>
    </div>
  );
}
