"use client";

/**
 * Bayi Churn Risk — Faz A.
 *
 * `bayi_churn_signals` view'ından risk_level='risk' bayileri liste,
 * recovery aksiyonu CTA (otomatik %5 kupon teklifi / WA hatırlatma /
 * detay sayfası deeplink).
 *
 * Üst 3 sekme: 🔴 Risk · 🟡 Watch · 🟢 Sağlıklı.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Risk {
  dealerId: string;
  dealerName: string;
  riskLevel: "ok" | "watch" | "risk";
  daysSinceLastOrder: number;
  maxOverdueDays: number;
  ordersLast30d: number;
  ordersPrev30d: number;
  balance: number;
  lastOrderAt: string | null;
}

interface ListResp {
  summary: { total: number; risk: number; watch: number; ok: number; scored: number };
  risks: Risk[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

const LEVEL_META = {
  risk:  { icon: "🔴", label: "Yüksek Risk",   cls: "bg-rose-50 dark:bg-rose-950/30 border-rose-200" },
  watch: { icon: "🟡", label: "Watch",         cls: "bg-amber-50 dark:bg-amber-950/30 border-amber-200" },
  ok:    { icon: "🟢", label: "Sağlıklı",      cls: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200" },
};

export default function BayiRiskPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"risk" | "watch" | "ok">("risk");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/bayi-scoring/list${qs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Risk verisi alınamadı."); return; }
      setData(d);
    } catch {
      setError("Bağlantı hatası.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center text-sm text-slate-500">Yükleniyor…</div>;
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

  const filtered = data.risks.filter(r => r.riskLevel === tab);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">⚠️ Churn Risk Yönetimi</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sipariş + vade + trend sinyallerine göre 3 seviye — recovery aksiyonu öner.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard icon="🔴" label="Risk" value={data.summary.risk} color="rose" active={tab === "risk"} onClick={() => setTab("risk")} />
        <StatCard icon="🟡" label="Watch" value={data.summary.watch} color="amber" active={tab === "watch"} onClick={() => setTab("watch")} />
        <StatCard icon="🟢" label="Sağlıklı" value={data.summary.ok} color="emerald" active={tab === "ok"} onClick={() => setTab("ok")} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">{LEVEL_META[tab].icon}</div>
          <p className="text-sm text-slate-500">
            {tab === "risk" ? "Risk altında bayi yok 🎉" : tab === "watch" ? "Watch listesinde bayi yok." : "Liste boş."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <RiskRow key={r.dealerId} r={r} token={token} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pt-4">
        Risk eşikleri: 60g sipariş yok veya 30g+ vade gecikmesi → 🔴 · 30g sipariş yok veya 7g+ vade veya hacim yarıya düşüş → 🟡
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, color, active, onClick }: {
  icon: string; label: string; value: number;
  color: "rose" | "amber" | "emerald"; active: boolean; onClick: () => void;
}) {
  const colors = {
    rose: active ? "border-rose-400 bg-rose-50" : "border-transparent hover:border-rose-200",
    amber: active ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-amber-200",
    emerald: active ? "border-emerald-400 bg-emerald-50" : "border-transparent hover:border-emerald-200",
  };
  return (
    <button onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-xl p-3 text-left border-2 transition ${colors[color]}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{icon} {label}</div>
      <div className="text-2xl font-bold mt-0.5 text-slate-900 dark:text-slate-100">{value}</div>
    </button>
  );
}

function RiskRow({ r, token }: { r: Risk; token: string }) {
  const meta = LEVEL_META[r.riskLevel];
  const trendDown = r.ordersPrev30d > 0 && r.ordersLast30d < r.ordersPrev30d;
  const href = token ? `/tr/bayiler/${r.dealerId}?t=${encodeURIComponent(token)}` : `/tr/bayiler/${r.dealerId}`;

  return (
    <div className={`border rounded-xl p-4 ${meta.cls}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{meta.icon}</span>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{r.dealerName || "(isimsiz)"}</h3>
            {r.balance > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-rose-700 font-medium">
                {fmtTry(r.balance)} borç
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>📅 Son sipariş: <strong>{r.daysSinceLastOrder} gün önce</strong></span>
            {r.maxOverdueDays > 0 && <span className="text-rose-700">⏰ Vade: <strong>{r.maxOverdueDays}g gecikme</strong></span>}
            {trendDown && <span className="text-amber-700">📉 Trend: 30g {r.ordersLast30d} vs prev {r.ordersPrev30d}</span>}
            <span>🛒 Son 30g: {r.ordersLast30d} sipariş</span>
          </div>
        </div>
        <div className="flex gap-1.5 whitespace-nowrap">
          <a href={href} className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium">
            Detay
          </a>
          <button
            onClick={() => alert("Recovery aksiyonu: kupon mint + WA hatırlatma (Faz B otomatik kampanya bağlantısı).")}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            Aksiyon Al
          </button>
        </div>
      </div>
    </div>
  );
}
