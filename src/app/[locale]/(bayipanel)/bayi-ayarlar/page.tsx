"use client";

/**
 * Bayi Tenant Ayarları — Sprint 1.
 *
 * Tek sayfa, 5 kart:
 *   1. Firma Profili (özet + bayi-profil sayfasına edit linki)
 *   2. Plan & Quota (tier, limits, agent quota usage)
 *   3. Fair-use Sınırları (bayi/WA mesaj limit göstergesi)
 *   4. WA Brifingi (admin sabah push toggle)
 *   5. Compliance (audit log link — Sprint 4 placeholder)
 *
 * Sadece okumak için herkes açar; "Düzenle" CTA admin'e görünür.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Firma {
  ticari_unvan: string | null;
  yetkili_adi: string | null;
  ofis_telefon: string | null;
  ofis_adresi: string | null;
  sektor: string | null;
  vergi_dairesi: string | null;
  vergi_no: string | null;
  kvk_no: string | null;
  iban: string | null;
  banka: string | null;
  email_kurumsal: string | null;
  web_sitesi: string | null;
  country: string;
  currency: string;
  locale: string;
  completed: boolean;
}

interface Tenant {
  id: string;
  name: string | null;
  createdAt: string | null;
  employeeCount: number;
  dealerCount: number;
}

interface Plan {
  tier: "starter" | "growth" | "pro";
  tierLabel: string;
  limits: {
    employees: number | null;
    dealers_fair_use: number | null;
    wa_msg_fair_use_month: number | null;
  };
  features: Record<string, boolean>;
  support: { sla: string; response_hours: number; concierge_setup: boolean };
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "critical" | "exceeded";
  period_end: string;
  days_until_reset: number;
  plan_key: string;
  plan_display: string;
}

interface SummaryResp {
  self: { id: string; role: string; displayName: string | null; isAdmin: boolean };
  tenant: Tenant;
  firma: Firma;
  plan: Plan;
  quota: Quota | null;
  notification_preferences: { wa_briefing_enabled: boolean };
}

const FEATURE_LABELS: Record<string, string> = {
  multi_accounting: "Çoklu muhasebe entegrasyonu",
  position_presets: "Pozisyon preset'leri",
  ai_dunning_text: "AI ile tahsilat metni",
  multi_territory: "Bölge müdürü hiyerarşisi",
  custom_api: "REST API erişimi",
  custom_integrations: "Özel entegrasyon",
  audit_log: "Audit log",
};

function limitText(n: number | null): string {
  return n === null ? "Sınırsız" : n.toLocaleString("tr-TR");
}

export default function BayiAyarlarPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [data, setData] = useState<SummaryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingBriefing, setSavingBriefing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/bayi-ayarlar/summary${qs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Ayarlar alınamadı."); return; }
      setData(d);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function toggleBriefing() {
    if (!data) return;
    const next = !data.notification_preferences.wa_briefing_enabled;
    setSavingBriefing(true);
    try {
      const r = await fetch("/api/bayi-ayarlar/wa-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, enabled: next }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Güncellenemedi."); return; }
      await load();
    } finally {
      setSavingBriefing(false);
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-medium">{error || "Veri alınamadı."}</p>
        </div>
      </div>
    );
  }

  const editFirmaHref = token ? `/tr/bayi-profil?t=${encodeURIComponent(token)}` : "/tr/bayi-profil";
  const usageHref = token ? `/tr/bayi-bildirimler?t=${encodeURIComponent(token)}` : "/tr/bayi-bildirimler";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">⚙️ Tenant Ayarları</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Firma profili, plan/quota, WA bildirimleri — tek panelden.
        </p>
      </header>

      {/* 1. FIRMA PROFILI */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">🏢 Firma Profili</h2>
            {!data.firma.completed && (
              <p className="text-xs text-amber-700 mt-0.5">⚠️ Profil eksik — kaydederek tamamlayın.</p>
            )}
          </div>
          {data.self.isAdmin && (
            <a href={editFirmaHref} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Düzenle →
            </a>
          )}
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Ticari Ünvan" value={data.firma.ticari_unvan} />
          <Field label="Yetkili" value={data.firma.yetkili_adi} />
          <Field label="Telefon" value={data.firma.ofis_telefon} />
          <Field label="E-posta" value={data.firma.email_kurumsal} />
          <Field label="Adres" value={data.firma.ofis_adresi} span="sm:col-span-2" />
          <Field label="Sektör" value={data.firma.sektor} />
          <Field label="Ülke" value={`${data.firma.country} · ${data.firma.currency}`} />
          <Field label={data.firma.country === "NL" ? "BTW No" : "Vergi No"} value={data.firma.vergi_no} />
          <Field label={data.firma.country === "NL" ? "KvK No" : "Vergi Dairesi"} value={data.firma.kvk_no || data.firma.vergi_dairesi} />
          <Field label="IBAN" value={data.firma.iban} />
          <Field label="Banka" value={data.firma.banka} />
        </dl>
      </section>

      {/* 2. PLAN & QUOTA */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">💎 Plan</h2>
            <p className="text-xs text-slate-500 mt-0.5">{data.tenant.name || "Bayi tenant"}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            data.plan.tier === "pro" ? "bg-violet-100 text-violet-700"
              : data.plan.tier === "growth" ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100 text-slate-700"
          }`}>
            {data.plan.tierLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Çalışan" value={`${data.tenant.employeeCount}${data.plan.limits.employees !== null ? `/${data.plan.limits.employees}` : ""}`} />
          <Stat label="Bayi" value={`${data.tenant.dealerCount}/${limitText(data.plan.limits.dealers_fair_use)}`} />
          <Stat label="Destek" value={data.plan.support.sla === "dedicated" ? "Özel" : data.plan.support.sla === "priority" ? "Öncelikli" : "E-posta"} />
        </div>
        {data.quota && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                UPU AI Asistan — {data.quota.plan_display}
              </span>
              <span className={data.quota.status === "exceeded" ? "text-rose-600 font-semibold" : "text-slate-600"}>
                {data.quota.used} / {data.quota.limit} mesaj
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  data.quota.status === "exceeded" ? "bg-rose-500"
                    : data.quota.status === "critical" ? "bg-orange-500"
                    : data.quota.status === "warning" ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, data.quota.percent)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data.quota.days_until_reset} gün sonra ({data.quota.period_end}) yenilenir.
            </p>
          </div>
        )}
      </section>

      {/* 3. FAIR-USE */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">⚖️ Fair-use Sınırları</h2>
        <p className="text-xs text-slate-500 mb-3">
          Yumuşak limitler — aşılırsa engelleme yok, sadece pakete geçiş tavsiyesi gider.
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600 dark:text-slate-400">Bayi sayısı tavanı</dt>
            <dd className="font-medium">{limitText(data.plan.limits.dealers_fair_use)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600 dark:text-slate-400">WA mesaj / ay</dt>
            <dd className="font-medium">{limitText(data.plan.limits.wa_msg_fair_use_month)}</dd>
          </div>
        </dl>
      </section>

      {/* 4. WA BRIFINGI */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">📱 WA Sabah Brifingi</h2>
            <p className="text-xs text-slate-500">
              Her sabah kısa özet WhatsApp push'u (panel detayı için link içerir). Diğer bildirimler
              (sipariş onayı, tahsilat vb.) bu ayardan bağımsız çalışır.
            </p>
          </div>
          <button
            onClick={() => void toggleBriefing()}
            disabled={!data.self.isAdmin || savingBriefing}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
              data.notification_preferences.wa_briefing_enabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
            aria-label="WA brifingi"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              data.notification_preferences.wa_briefing_enabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
        {!data.self.isAdmin && (
          <p className="text-xs text-slate-400 mt-2">Sadece admin değiştirebilir.</p>
        )}
      </section>

      {/* 5. PLAN FEATURES + COMPLIANCE */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">🎁 Plan Özellikleri</h2>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(data.plan.features).map(([key, on]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
              }`}>
                {on ? "✓" : "—"}
              </span>
              <span className={on ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}>
                {FEATURE_LABELS[key] || key}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 mt-4 pt-3 text-xs text-slate-500">
          🔒 Compliance / Audit log (Pro tier) — detay sayfa Sprint 4&apos;te eklenecek.
          {!data.plan.features.audit_log && (
            <span className="block mt-1">Mevcut planınızda etkin değil — Pro&apos;ya yükseltin.</span>
          )}
        </div>
      </section>

      <div className="text-xs text-slate-400 text-center pt-2">
        Soru için <a href={usageHref} className="text-indigo-600 hover:underline">UPU asistanına</a> sorabilirsin.
      </div>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string | null; span?: string }) {
  return (
    <div className={span || ""}>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}
