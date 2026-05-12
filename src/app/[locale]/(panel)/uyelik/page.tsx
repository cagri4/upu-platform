"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Crown,
  Sparkles,
  Gift,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Skeleton, HeroBanner } from "@/components/banking";

interface Plan {
  id: "pro_monthly" | "pro_yearly";
  label: string;
  amount: string;
  currency: string;
  interval: string;
  badge?: string;
}

interface Subscription {
  plan: "trial" | "free" | "pro_monthly" | "pro_yearly" | string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

type Status = "loading" | "ready" | "error";

const FEATURE_ROWS: Array<{ label: string; free: boolean; pro: boolean }> = [
  { label: "Sınırsız mülk, müşteri, sunum kaydı", free: true, pro: true },
  { label: "WhatsApp tek tıkla yönet (mülk ekle, müşteri kaydet)", free: true, pro: true },
  { label: "Kişisel emlak web sayfası", free: true, pro: true },
  { label: "Sahibinden Chrome eklentisi", free: true, pro: true },
  { label: "Akıllı bildirimler — sıcak müşteri, sözleşme bitiyor", free: false, pro: true },
  { label: "Mülk ve ilan takibi (yeni ilan, fiyat değişimi)", free: false, pro: true },
  { label: "Müşteri-mülk eşleşme uyarıları", free: false, pro: true },
  { label: "Sunum açılma bildirimleri", free: false, pro: true },
  { label: "Web sitem ziyaretçi raporu — haftalık", free: false, pro: true },
  { label: "AI proaktif öneriler", free: false, pro: true },
];

export default function UyelikPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  useEffect(() => {
    if (searchParams.get("status") === "success") {
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 4000);
    }
  }, [searchParams]);

  useEffect(() => {
    const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/uyelik/init${tokenQs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
        setSub(d.subscription);
        setPlans(d.plans || []);
        setTier(d.tier || "free");
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handleCheckout(planId: Plan["id"]) {
    setLoadingPlan(planId);
    setError("");
    try {
      const res = await fetch("/api/uyelik/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, plan: planId }),
      });
      const d = await res.json();
      if (!res.ok || !d.checkoutUrl) {
        setError(d.error || "Ödeme başlatılamadı.");
        setLoadingPlan(null);
        return;
      }
      window.location.href = d.checkoutUrl;
    } catch {
      setError("Bağlantı hatası.");
      setLoadingPlan(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Pro aboneliği iptal edilecek — periyot sonunda Free'ye düşersiniz. Onaylıyor musunuz?")) return;
    setCanceling(true);
    setError("");
    try {
      const res = await fetch("/api/uyelik/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "İptal edilemedi.");
        setCanceling(false);
        return;
      }
      const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
      const init = await fetch(`/api/uyelik/init${tokenQs}`, { credentials: "same-origin" });
      const initData = await init.json();
      setSub(initData.subscription);
      setTier(initData.tier);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setCanceling(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-5">
        <Skeleton height="h-9" className="w-1/2" />
        <Skeleton height="h-24" />
        <Skeleton height="h-40" />
        <Skeleton height="h-40" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
      </div>
    );
  }
  if (!sub) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400 text-sm">—</p>
      </div>
    );
  }

  const isProTier = tier === "pro";
  const isTrial = sub.plan === "trial";
  const isPaidPro = sub.plan === "pro_monthly" || sub.plan === "pro_yearly";

  // Hero icon + content
  let HeroIcon = Sparkles;
  let heroTitle = "Free Plan";
  let heroSubtitle = "Pro'ya geç ve tüm özelliklerin kilidini aç.";
  if (isTrial && sub.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    HeroIcon = Gift;
    heroTitle = `${daysLeft} gün deneme kaldı`;
    heroSubtitle = "Pro özelliklerin tamamı şu an açık. Süre dolmadan abone ol, kesintisiz devam et.";
  } else if (isPaidPro) {
    HeroIcon = Crown;
    heroTitle = "Pro Aktif";
    if (sub.current_period_end) {
      const next = new Date(sub.current_period_end).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      heroSubtitle = sub.cancel_at_period_end
        ? `İptal edildi — ${next} tarihinde sona eriyor.`
        : `Sonraki yenileme: ${next}`;
    }
  }

  return (
    <div className="space-y-5 pb-12">
      {successFlash && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
          Ödeme alındı — Pro üyelik aktif olabilir. Birkaç saniye sürebilir.
        </div>
      )}

      <HeroBanner title={heroTitle} subtitle={heroSubtitle} Icon={HeroIcon} />

      {/* Plan selector — sadece Free veya Trial user için */}
      {!isPaidPro && (
        <section>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">Pro Planlar</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map(p => {
              const isYearly = p.id === "pro_yearly";
              return (
                <div
                  key={p.id}
                  className={`relative bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border-2 ${
                    isYearly
                      ? "border-emerald-500 dark:border-emerald-600"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm">
                      {p.badge}
                    </span>
                  )}
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {p.label}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                    €{Number(p.amount).toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">/ {p.interval}</p>
                  <button
                    type="button"
                    onClick={() => void handleCheckout(p.id)}
                    disabled={loadingPlan !== null}
                    className={`mt-4 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm transition active:scale-[0.98] disabled:opacity-60 ${
                      isYearly
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {loadingPlan === p.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Yönlendiriliyor</>
                    ) : (
                      <><Crown className="w-4 h-4" strokeWidth={2.2} /> Pro&apos;ya Geç</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 px-1">
            Ödemeleriniz Mollie üzerinden güvenle alınır. İstediğin zaman iptal edebilirsin.
          </p>
        </section>
      )}

      {/* Plan Karşılaştırması — 3-sütun tablo */}
      <section>
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-3 px-1">Plan Karşılaştırması</p>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                <th className="text-left font-semibold px-3 py-3 w-auto">Özellik</th>
                <th className="text-center font-semibold px-2 py-3 w-14 sm:w-20">Free</th>
                <th className="text-center font-semibold px-2 py-3 w-14 sm:w-20 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800 even:bg-slate-50/40 dark:even:bg-slate-950/40">
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200 leading-snug">{row.label}</td>
                  <td className="text-center px-2 py-3" aria-label={row.free ? "Var" : "Yok"}>
                    {row.free
                      ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" strokeWidth={2.8} />
                      : <X className="w-4 h-4 text-slate-400 dark:text-slate-600 mx-auto" strokeWidth={2.5} />}
                  </td>
                  <td className="text-center px-2 py-3 bg-emerald-50/60 dark:bg-emerald-950/30" aria-label={row.pro ? "Var" : "Yok"}>
                    {row.pro
                      ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" strokeWidth={2.8} />
                      : <X className="w-4 h-4 text-slate-400 dark:text-slate-600 mx-auto" strokeWidth={2.5} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isProTier && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1 flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
            Pro özellikleri açmak için yukarıdaki planlardan birini seç.
          </p>
        )}
      </section>

      {/* Cancel button — sadece Pro paid user için */}
      {isPaidPro && !sub.cancel_at_period_end && (
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={canceling}
          className="flex items-center justify-center gap-1.5 w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 py-3 rounded-2xl text-sm font-medium disabled:opacity-60 active:scale-[0.98] transition"
        >
          {canceling ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> İptal ediliyor</>
          ) : (
            "Aboneliği iptal et"
          )}
        </button>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
        </div>
      )}
    </div>
  );
}
