"use client";

/**
 * /tr/bayi-davet — Dağıtıcı evergreen statik davet link sayfası.
 *
 * Slug fetch → statik link göster + 3 paylaş buton (Kopyala / WA / SMS).
 * Bayi link'i tıkladığında /davet/[slug] route'una iner; orada kendi
 * telefon + isim + (opt) mağaza adı'nı doldurup hesabı açar.
 *
 * Mevcut dynamic davet (bayilerim → manuel ekle) ile paralel yaşar.
 */

import { useEffect, useState } from "react";
import { Send, Copy, MessageCircle, Smartphone, Check, Mail } from "lucide-react";
import { HeroBanner } from "@/components/banking";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

interface SlugResp {
  ok: true;
  tenant_slug: string;
  slug: string;
  display_name: string | null;
}

export default function BayiDavetPage() {
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [distributorName, setDistributorName] = useState<string>("Firmanız");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/bayi-davet/slug", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Slug alınamadı.");
        const sr = d as SlugResp;
        setTenantSlug(sr.tenant_slug);
        setSlug(sr.slug);
        if (sr.display_name) setDistributorName(sr.display_name);
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, []);

  const acceptUrl = tenantSlug && slug ? `${APP_URL}/davet/${tenantSlug}/${slug}` : "";
  const shareMessage = slug
    ? `Merhaba, ${distributorName} sizi UPU sistemine bayi olarak davet ediyor. Aşağıdaki linke tıklayarak hesabınızı açabilirsiniz: ${acceptUrl}`
    : "";

  async function handleCopy() {
    if (!acceptUrl) return;
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sessiz */
    }
  }

  function handleWhatsApp() {
    if (!shareMessage) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
      "_blank",
      "noopener",
    );
  }

  function handleSms() {
    if (!shareMessage) return;
    window.location.href = `sms:?body=${encodeURIComponent(shareMessage)}`;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Send}
        title="Bayi Davet"
        subtitle="Aşağıdaki linki bayilerinle paylaş. Tıklayan bayi telefonu doğrular ve kendi paneline iner — mağaza bilgilerini sonradan kendisi doldurur."
      />

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
          Davet linkin hazırlanıyor…
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Davet Linkin
              </p>
              <p className="font-mono text-sm sm:text-base text-slate-900 dark:text-white break-all mt-1">
                {acceptUrl}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-col items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 active:scale-95 transition rounded-xl py-3"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
                ) : (
                  <Copy className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
                )}
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {copied ? "Kopyalandı" : "Kopyala"}
                </span>
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex flex-col items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition rounded-xl py-3 text-white"
              >
                <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
                <span className="text-[11px] font-medium">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleSms}
                className="flex flex-col items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded-xl py-3 text-white"
              >
                <Smartphone className="w-5 h-5" strokeWidth={2.2} />
                <span className="text-[11px] font-medium">SMS</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Paylaşılacak Mesaj
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {shareMessage}
            </p>
          </div>

          <a
            href="/tr/bayi-davetleri"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <Mail className="w-4 h-4 text-slate-500" strokeWidth={2.2} />
              Manuel davetlerim
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-sm">→</span>
          </a>
        </>
      )}
    </div>
  );
}
