"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

const PRO_FEATURES = [
  { label: "Akıllı bildirimler — sıcak müşteri, sözleşme bitiyor, AI önerileri", free: false },
  { label: "Mülk ve ilan takibi (yeni ilan, fiyat değişimi)", free: false },
  { label: "Müşteri-mülk eşleşme uyarıları", free: false },
  { label: "Sunum açılma bildirimleri", free: false },
  { label: "Web sitem ziyaretçi raporu — haftalık", free: false },
  { label: "AI proaktif öneriler — kim arasın, hangi mülk fiyatı düşmeli", free: false },
  { label: "Sınırsız mülk, müşteri, sunum kaydı", free: true },
  { label: "WhatsApp tek tıkla yönet (mülk ekle, müşteri kaydet)", free: true },
  { label: "Kişisel emlak web sayfası (/u/<slug>)", free: true },
  { label: "Sahibinden Chrome eklentisi (otomatik form doldurma)", free: true },
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
    // ?status=success ile döndüğünde flash mesajı
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
      // Reload subscription state
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

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <p className="text-slate-600 text-sm">{error}</p>
  </Center>;
  if (!sub) return <Center>—</Center>;

  // Hero hesaplamaları
  const isProTier = tier === "pro";
  const isTrial = sub.plan === "trial";
  const isFree = sub.plan === "free";
  const isPaidPro = sub.plan === "pro_monthly" || sub.plan === "pro_yearly";

  let heroBadge = "";
  let heroSub = "";
  if (isTrial && sub.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    heroBadge = `🎁 ${daysLeft} gün deneme kaldı`;
    heroSub = "Pro özelliklerin tamamı şu an açık. Süre dolmadan abone olarak kesintisiz devam et.";
  } else if (isPaidPro) {
    heroBadge = "⭐ Pro Aktif";
    if (sub.current_period_end) {
      const next = new Date(sub.current_period_end).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      heroSub = sub.cancel_at_period_end
        ? `İptal edildi — ${next} tarihinde sona eriyor.`
        : `Sonraki yenileme: ${next}`;
    }
  } else {
    heroBadge = "Free Plan";
    heroSub = "Pro'ya geç ve tüm özelliklerin kilidini aç.";
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-md mx-auto p-4 space-y-5">
        {successFlash && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm">
            ✅ Ödeme alındı — Pro üyelik aktif olabilir. Birkaç saniye sürebilir.
          </div>
        )}

        {/* Hero */}
        <div className={`rounded-2xl p-5 text-white ${
          isPaidPro ? "bg-gradient-to-br from-violet-600 to-fuchsia-700" :
          isTrial ? "bg-gradient-to-br from-amber-500 to-orange-600" :
          "bg-gradient-to-br from-slate-600 to-slate-800"
        }`}>
          <div className="text-3xl mb-1">{isPaidPro ? "💎" : isTrial ? "🎁" : "⭐"}</div>
          <h1 className="text-xl font-bold">Üyelik</h1>
          <p className="text-white/90 text-sm mt-2 font-semibold">{heroBadge}</p>
          {heroSub && <p className="text-white/80 text-sm mt-1 leading-relaxed">{heroSub}</p>}
        </div>

        {/* Plan selector — sadece Free veya Trial user için */}
        {!isPaidPro && (
          <section>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 px-1">Pro Planlar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map(p => (
                <div key={p.id} className={`relative bg-white rounded-2xl p-5 shadow-sm border-2 ${p.id === "pro_yearly" ? "border-violet-400" : "border-slate-200"}`}>
                  {p.badge && (
                    <span className="absolute -top-2 right-4 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {p.badge}
                    </span>
                  )}
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1">{p.label}</p>
                  <p className="text-3xl font-black text-slate-900 leading-none">€{Number(p.amount).toFixed(0)}</p>
                  <p className="text-xs text-slate-500 mt-1">/ {p.interval}</p>
                  <button
                    type="button"
                    onClick={() => void handleCheckout(p.id)}
                    disabled={loadingPlan !== null}
                    className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm shadow ${
                      p.id === "pro_yearly"
                        ? "bg-violet-600 hover:bg-violet-700 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    } disabled:opacity-60`}
                  >
                    {loadingPlan === p.id ? "Yönlendiriliyor..." : "Pro'ya Geç"}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 px-1">
              Ödemeleriniz Mollie üzerinden güvenle alınır. İstediğin zaman iptal edebilirsin.
            </p>
          </section>
        )}

        {/* Pro features list */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900 mb-3">Plan Karşılaştırması</p>
          <ul className="space-y-2 text-sm">
            {PRO_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`text-base ${f.free ? "text-emerald-600" : isProTier ? "text-violet-600" : "text-slate-300"}`}>
                  {f.free ? "✓" : isProTier ? "✓" : "🔒"}
                </span>
                <span className={`flex-1 leading-snug ${f.free ? "text-slate-800" : isProTier ? "text-slate-800" : "text-slate-500"}`}>
                  {f.label}
                  {!f.free && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded align-middle">
                      Pro
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Cancel button — sadece Pro paid user için */}
        {isPaidPro && !sub.cancel_at_period_end && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={canceling}
            className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            {canceling ? "İptal ediliyor..." : "Aboneliği iptal et"}
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
