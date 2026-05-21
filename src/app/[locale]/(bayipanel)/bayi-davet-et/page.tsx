"use client";

/**
 * Bayi referans davet sayfası — Faz C 3.7.
 * Bayinin unique kodu + paylaş butonu + kazanım stats.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Code {
  id: string;
  code: string;
  reward_amount: number;
  reward_currency: string;
  current_uses: number;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface Credit {
  balance: number;
  currency: string;
  lifetime_earned: number;
  lifetime_used: number;
  last_movement_at: string | null;
}

interface Referral {
  id: string;
  status: string;
  referred_name: string | null;
  reward_amount: number | null;
  reward_currency: string | null;
  invited_at: string;
  accepted_at: string | null;
  earned_at: string | null;
}

interface Counts {
  accepted: number; earned: number; pending: number; total: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Beklemede", cls: "bg-slate-100 text-slate-600" },
  accepted: { label: "Kabul edildi", cls: "bg-amber-100 text-amber-700" },
  earned: { label: "✓ Kredi tahakkuk etti", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Süresi doldu", cls: "bg-slate-100 text-slate-500" },
  rejected: { label: "Reddedildi", cls: "bg-rose-50 text-rose-600" },
};

export default function BayiDavetEtPage() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [code, setCode] = useState<Code | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [counts, setCounts] = useState<Counts>({ accepted: 0, earned: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/bayi-referral/info${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) {
      setCode(d.code);
      setCredit(d.credit);
      setReferrals(d.referrals || []);
      setCounts(d.counts || { accepted: 0, earned: 0, pending: 0, total: 0 });
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setGenerating(true);
    await fetch("/api/bayi-referral/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined }),
    });
    setGenerating(false);
    await load();
  }

  const inviteLink = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/tr/uye-ol?ref=${encodeURIComponent(code.code)}`
    : null;

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWA() {
    if (!inviteLink || typeof window === "undefined") return;
    const text = `Birlikte çalışalım! Şu link ile sisteme kaydol, ben de fayda göreyim:\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">🎁 Davet Et &amp; Kazan</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bayi davet et — kabul edip ilk siparişini geçince hesabına kredi yansır.
        </p>
      </header>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : (
        <>
          {credit && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Bakiye" value={`₺${Number(credit.balance).toLocaleString("tr-TR")}`} highlight />
              <Stat label="Kazanılmış" value={`₺${Number(credit.lifetime_earned).toLocaleString("tr-TR")}`} />
              <Stat label="Kullanılmış" value={`₺${Number(credit.lifetime_used).toLocaleString("tr-TR")}`} />
            </div>
          )}

          {!code ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 text-center">
              <div className="text-4xl mb-2">🚀</div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Davet kodun yok</h2>
              <p className="text-sm text-slate-500 mt-1">
                Şimdi oluştur, davet ettiğin her bayi için ₺100 kredi kazan.
              </p>
              <button onClick={() => void generate()} disabled={generating}
                className="mt-3 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-medium">
                {generating ? "Oluşturuluyor…" : "Kod oluştur"}
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-5 mb-4">
              <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">DAVET KODUN</div>
              <div className="text-3xl font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100 mb-2">
                {code.code}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Her başarılı davet için <strong>₺{Number(code.reward_amount).toLocaleString("tr-TR")}</strong> kredi kazanırsın.
                {code.current_uses > 0 && <> · {code.current_uses} kullanım</>}
              </div>
              {inviteLink && (
                <>
                  <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 p-2 mb-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Davet linki</div>
                    <div className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all">{inviteLink}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void copyLink()}
                      className="flex-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-medium">
                      {copied ? "✓ Kopyalandı" : "🔗 Linki kopyala"}
                    </button>
                    <button onClick={shareWA}
                      className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-medium">
                      📱 WhatsApp ile paylaş
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          {code && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Beklemede" value={counts.pending + counts.accepted} />
              <Stat label="Tahakkuk" value={counts.earned} />
              <Stat label="Toplam" value={counts.total} />
            </div>
          )}

          {/* Geçmiş */}
          {referrals.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Davet Geçmişi
              </div>
              <ul className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {referrals.map(r => {
                  const meta = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
                  return (
                    <li key={r.id} className="px-4 py-2 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.referred_name || "—"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(r.invited_at).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${highlight ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800"}`}>
      <div className={`text-2xl font-bold ${highlight ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-slate-100"}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
