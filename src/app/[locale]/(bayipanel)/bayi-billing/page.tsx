"use client";

/**
 * Bayi Billing — Sprint 3 (Mollie subscription).
 *
 * 4 bölüm:
 *   1. Mevcut Abonelik kart — plan, status, periyot, iptal
 *   2. Plan grid — 4 tier (Free/Starter/Pro/Premium), "Plana Geç" CTA
 *   3. Fatura geçmişi — Mollie customer payments
 *   4. Trial bilgisi (varsa)
 *
 * Admin-only role guard layout level. Free plan ücretsiz — "Pakete Geç"
 * yalnız ücretli tier'lar için (free seçilirse cancel önerisi).
 *
 * 429 quota modal'dan deeplink: /tr/bayi-billing?from=quota → "Pakete Geç"
 * butonuna scroll/highlight.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Subscription {
  user_id: string;
  plan: string;
  status: string;
  amount: number | null;
  currency: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  provider_subscription_id: string | null;
  trial_ends_at: string | null;
}

interface Plan {
  key: string;
  displayName: string;
  monthlyMessageLimit: number;
  monthlyPriceEur: number;
  features: Record<string, unknown>;
}

interface Invoice {
  id: string;
  status: string;
  amount: string;
  currency: string;
  description: string | null;
  created_at: string;
  invoice_url: string | null;
  sequence_type: string | null;
}

interface StatusResp {
  self: { id: string; role: string; isAdmin: boolean };
  subscription: Subscription | null;
  plans: Plan[];
  invoices: Invoice[];
}

const PLAN_ICONS: Record<string, string> = {
  free: "🆓", starter: "🌱", pro: "💎", premium: "👑",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtAmount(n: number, cur: string = "EUR"): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "Aktif",          cls: "bg-emerald-100 text-emerald-700" },
  pending:   { label: "Ödeme bekliyor", cls: "bg-amber-100 text-amber-700" },
  past_due:  { label: "Ödeme başarısız", cls: "bg-rose-100 text-rose-700" },
  canceled:  { label: "İptal edildi",   cls: "bg-slate-100 text-slate-700" },
  expired:   { label: "Süresi doldu",   cls: "bg-slate-100 text-slate-700" },
};

export default function BayiBillingPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const returnFromMollie = params.get("return"); // "success" | "cancel"
  const fromQuota = params.get("from") === "quota";

  const [data, setData] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [returnBanner, setReturnBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/billing/status${qs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Durum alınamadı."); return; }
      setData(d);
    } catch {
      setError("Bağlantı hatası.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (returnFromMollie === "success") {
      setReturnBanner("✅ Ödeme alındı — abonelik aktive ediliyor (1-2 dakika sürebilir).");
    } else if (returnFromMollie === "cancel") {
      setReturnBanner("❌ Ödeme iptal edildi — tekrar denemek istersen plan seç.");
    }
  }, [returnFromMollie]);

  async function startCheckout(planKey: string) {
    if (!data?.self.isAdmin) return;
    setBusy(planKey);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, plan_key: planKey }),
      });
      const d = await r.json();
      if (!r.ok || !d.checkout_url) {
        alert(d.error || "Ödeme başlatılamadı.");
        return;
      }
      window.location.href = d.checkout_url;
    } finally { setBusy(null); }
  }

  async function cancelSubscription() {
    if (!confirm("Aboneliği iptal etmek istediğine emin misin? Mevcut periyot sonuna kadar erişim devam eder.")) return;
    setBusy("cancel");
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST", credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "İptal başarısız."); return; }
      await load();
    } finally { setBusy(null); }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-medium">{error || "Veri alınamadı."}</p>
        </div>
      </div>
    );
  }

  const sub = data.subscription;
  const currentPlan = sub?.plan || "free";
  const trialActive = sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now();
  const isCancelled = sub?.cancel_at_period_end === true;
  const statusMeta = sub ? STATUS_META[sub.status] || { label: sub.status, cls: "bg-slate-100 text-slate-700" } : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">💳 Faturalama & Abonelik</h1>
        <p className="text-sm text-slate-500 mt-0.5">Plan yönet, abonelik durumu, fatura geçmişi.</p>
      </header>

      {returnBanner && (
        <div className={`rounded-xl p-3 text-sm ${returnFromMollie === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
          {returnBanner}
        </div>
      )}
      {fromQuota && (
        <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl p-3 text-sm">
          🎯 Aylık mesaj kotanızı doldurdunuz — daha fazla mesaj için pakete geçin.
        </div>
      )}

      {/* MEVCUT ABONELİK */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Mevcut Abonelik</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xl">{PLAN_ICONS[currentPlan] || "📦"}</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {data.plans.find(p => p.key === currentPlan)?.displayName || currentPlan}
              </span>
              {statusMeta && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.cls}`}>
                  {statusMeta.label}
                </span>
              )}
              {trialActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                  Deneme — {fmtDate(sub!.trial_ends_at)} sonu
                </span>
              )}
            </div>
            {sub && sub.amount !== null && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {fmtAmount(Number(sub.amount), sub.currency || "EUR")} / ay
              </p>
            )}
            {sub?.current_period_end && (
              <p className="text-xs text-slate-500 mt-1">
                Sonraki ödeme: <span className="font-medium">{fmtDate(sub.current_period_end)}</span>
                {isCancelled && <span className="ml-1 text-amber-700">· iptal işlendi (periyot sonuna kadar aktif)</span>}
              </p>
            )}
          </div>
          {sub?.provider_subscription_id && !isCancelled && data.self.isAdmin && (
            <button
              onClick={() => void cancelSubscription()}
              disabled={busy === "cancel"}
              className="text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Aboneliği iptal et
            </button>
          )}
        </div>
      </section>

      {/* PLAN GRID */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Planlar</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.plans.map(plan => {
            const isCurrent = plan.key === currentPlan;
            const isFree = plan.monthlyPriceEur === 0;
            return (
              <div
                key={plan.key}
                className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border-2 flex flex-col ${
                  isCurrent ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 dark:border-slate-800/50"
                }`}
              >
                <div className="text-2xl">{PLAN_ICONS[plan.key] || "📦"}</div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-1">{plan.displayName}</h3>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {isFree ? <span className="text-emerald-600">Ücretsiz</span> : fmtAmount(plan.monthlyPriceEur)}
                  {!isFree && <span className="text-xs text-slate-500 font-normal"> / ay</span>}
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-400 mt-3 space-y-1.5 flex-1">
                  <li>📨 <strong>{plan.monthlyMessageLimit.toLocaleString("tr-TR")}</strong> AI mesajı / ay</li>
                  <li>🔔 Tüm bildirimler</li>
                  <li>👥 {plan.key === "free" ? "1 kullanıcı" : plan.key === "starter" ? "3 kullanıcı" : plan.key === "pro" ? "10 kullanıcı" : "Sınırsız"}</li>
                  {plan.key === "premium" && <li>🎯 Özel destek (1 saat SLA)</li>}
                  {plan.key === "pro" && <li>📋 Audit log + öncelikli destek</li>}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <button disabled className="w-full text-sm py-2 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed">
                      Mevcut Plan
                    </button>
                  ) : isFree ? (
                    <button
                      disabled
                      className="w-full text-sm py-2 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
                      title="Free planına geçmek için mevcut aboneliği iptal et"
                    >
                      Free planı için iptal kullan
                    </button>
                  ) : (
                    <button
                      onClick={() => void startCheckout(plan.key)}
                      disabled={!data.self.isAdmin || busy === plan.key}
                      className="w-full text-sm py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
                    >
                      {busy === plan.key ? "Yönlendiriliyor…" : "Plana Geç →"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!data.self.isAdmin && (
          <p className="text-xs text-slate-400 mt-2 text-center">Plan değişikliği için admin yetkisi gerekli.</p>
        )}
      </section>

      {/* FATURA GEÇMİŞİ */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">📄 Fatura Geçmişi</h2>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Henüz fatura yok — ilk ödemeden sonra burada görünecek.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {data.invoices.map(inv => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{inv.description || "UPU Bayi aboneliği"}</div>
                  <div className="text-xs text-slate-500">
                    {fmtDate(inv.created_at)} · {inv.sequence_type === "first" ? "İlk ödeme" : inv.sequence_type === "recurring" ? "Otomatik yenileme" : "Tek seferlik"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {fmtAmount(Number(inv.amount), inv.currency)}
                  </div>
                  <div className={`text-[10px] uppercase tracking-wide font-medium ${
                    inv.status === "paid" ? "text-emerald-600"
                      : inv.status === "open" || inv.status === "pending" ? "text-amber-600"
                      : "text-slate-400"
                  }`}>
                    {inv.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400 text-center pt-2">
        Ödemeler <strong>Mollie</strong> üzerinden işlenir — iDEAL, kredi kartı, SEPA Direct Debit desteklenir.
      </p>
    </div>
  );
}
