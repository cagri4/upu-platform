"use client";

/**
 * Bayi panel dashboard'a mount edilen risk uyarı banner'ı.
 *
 * `/api/bayi-scoring/list` çağırır, risk_level='risk' sayısı varsa
 * üst bölümde göze çarpan bir alert gösterir. Tıklayınca /tr/bayi-risk.
 *
 * Admin + satis görür (SALES list); muhasebe/depocu için satışla
 * doğrudan ilgili değil — gizli.
 */
import { useEffect, useState } from "react";

interface Summary {
  risk: number;
  watch: number;
  ok: number;
  total: number;
}

interface Props {
  token?: string;
  userRole?: string | null;
}

const VISIBLE_ROLES = new Set(["admin", "user", "satis"]);

export function ChurnRiskBanner({ token = "", userRole = null }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole && !VISIBLE_ROLES.has(userRole)) {
      setLoading(false);
      return;
    }
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-scoring/list${qs}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setSummary(d.summary); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [token, userRole]);

  if (loading || !summary) return null;
  if (summary.risk === 0 && summary.watch === 0) return null;

  const href = token ? `/tr/bayi-risk?t=${encodeURIComponent(token)}` : "/tr/bayi-risk";

  return (
    <a
      href={href}
      className={`block border rounded-xl p-3 sm:p-4 transition hover:shadow-sm ${
        summary.risk > 0
          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50"
          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{summary.risk > 0 ? "🔴" : "🟡"}</span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${summary.risk > 0 ? "text-rose-800 dark:text-rose-200" : "text-amber-800 dark:text-amber-200"}`}>
              {summary.risk > 0 ? (
                <><strong>{summary.risk}</strong> bayi risk altında</>
              ) : (
                <><strong>{summary.watch}</strong> bayi watch listesinde</>
              )}
              {summary.watch > 0 && summary.risk > 0 && (
                <span className="font-normal"> · {summary.watch} watch</span>
              )}
            </p>
            <p className={`text-xs ${summary.risk > 0 ? "text-rose-700" : "text-amber-700"}`}>
              Aksiyon listesini görmek için tıkla — recovery kuponu, hatırlatma veya WA mesajı önerir.
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ${summary.risk > 0 ? "text-rose-700" : "text-amber-700"}`}>
          Aksiyon Al →
        </span>
      </div>
    </a>
  );
}
