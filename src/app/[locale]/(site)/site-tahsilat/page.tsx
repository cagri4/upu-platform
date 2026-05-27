"use client";

/**
 * /tr/site-tahsilat — Modül 1: Tahsilat & Banka POS (Sprint 2).
 *
 * DEMO ONLY — Mock POS provider. Yönetici "Ödeme Yap" butonu ile borçlu
 * aidat satırını seçer, sahte kart bilgisi girer, charge() always-succeeds,
 * sy_dues_ledger + sy_income_expenses güncellenir.
 *
 * 2 sekme:
 *   - Borçlu Aidatlar (ödeme alma akışı)
 *   - Tahsilat Geçmişi (gelir kayıtları)
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCw,
} from "lucide-react";
import { HeroBanner, ListCard, Skeleton, StatCard } from "@/components/banking";

interface UnpaidEntry {
  id: string;
  period: string;
  unit_number: string;
  amount_tl: number;
  paid_tl: number;
  late_tl: number;
  owed_tl: number;
  is_paid: boolean;
}

interface IncomeEntry {
  id: string;
  period: string;
  description: string;
  amount_kurus: number;
  created_at: string;
}

type Tab = "unpaid" | "history";

function formatTL(n: number): string {
  if (!n) return "₺0";
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

function formatPeriod(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m) return p;
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${months[parseInt(m[2], 10) - 1] || m[2]} ${m[1]}`;
}

export default function SiteTahsilatPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [tab, setTab] = useState<Tab>("unpaid");
  const [loading, setLoading] = useState(true);
  const [unpaid, setUnpaid] = useState<UnpaidEntry[]>([]);
  const [history, setHistory] = useState<IncomeEntry[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<UnpaidEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    try {
      const [unpaidRes, historyRes] = await Promise.all([
        fetch(`/api/site/aidat${qs}${qs ? "&" : "?"}filter=unpaid`, { credentials: "same-origin" }).then((r) => r.json()),
        fetch(`/api/site/tahsilat${qs}`, { credentials: "same-origin" }).then((r) => r.json()),
      ]);

      if (unpaidRes?.error) setError(unpaidRes.error);
      else setUnpaid(unpaidRes.ledger || []);

      if (historyRes?.error) setError(historyRes.error);
      else {
        setHistory(historyRes.payments || []);
        setTotalCollected(historyRes.total_kurus || 0);
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Receipt}
        title="Tahsilat"
        subtitle="Aidat ödemeleri ve banka sanal POS — DEMO mode (mock provider)"
      />

      {/* Demo uyarısı */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Demo Mod
        </p>
        <p>
          Banka sanal POS henüz mock entegrasyon. &ldquo;Ödeme Yap&rdquo; her zaman
          başarılı döner; gerçek kart çekimi yapılmaz. Iyzico/PayTR entegrasyonu V2.
        </p>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3">
        {loading ? (
          <><Skeleton height="h-28" /><Skeleton height="h-28" /></>
        ) : (
          <>
            <StatCard Icon={AlertTriangle} value={unpaid.length} label="Borçlu Daire" />
            <StatCard Icon={CheckCircle2} value={formatTL(totalCollected / 100)} label="Toplam Tahsilat" />
          </>
        )}
      </div>

      {/* Tab */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-1.5 inline-flex shadow-sm">
        <TabButton active={tab === "unpaid"} onClick={() => setTab("unpaid")}>Borçlu</TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>Geçmiş</TabButton>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Borçlu sekme */}
      {tab === "unpaid" && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
            </div>
          ) : unpaid.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
              <div className="text-4xl">✅</div>
              <div className="font-semibold text-slate-900 dark:text-white">Tüm aidatlar ödendi</div>
            </div>
          ) : (
            unpaid.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setModal(u)}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm hover:shadow-md transition flex items-center gap-3 text-left active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Daire {u.unit_number} · {formatPeriod(u.period)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Borç {formatTL(u.owed_tl)}
                    {u.late_tl > 0 && ` · gecikme ${formatTL(u.late_tl)}`}
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ödeme Al</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Geçmiş sekme */}
      {tab === "history" && (
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
              <div className="text-4xl">📋</div>
              <div className="font-semibold text-slate-900 dark:text-white">Tahsilat kaydı yok</div>
            </div>
          ) : (
            history.map((h) => (
              <ListCard
                key={h.id}
                Icon={Receipt}
                title={`${formatTL(h.amount_kurus / 100)} · ${formatPeriod(h.period)}`}
                subtitle={`${h.description}  ·  ${new Date(h.created_at).toLocaleDateString("tr-TR")}`}
                rightLabel="Ödendi"
              />
            ))
          )}
        </div>
      )}

      {modal && (
        <PaymentModal
          entry={modal}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function PaymentModal({
  entry,
  token,
  onClose,
  onSuccess,
}: {
  entry: UnpaidEntry;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amountTL, setAmountTL] = useState(String(Math.round(entry.owed_tl)));
  const [cardHolder, setCardHolder] = useState("DEMO ÖDEYEN");
  const [cardMasked, setCardMasked] = useState("**** **** **** 1234");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    const amount = Number(amountTL);
    if (isNaN(amount) || amount <= 0) {
      setResult({ kind: "err", text: "Geçerli tutar girin." });
      return;
    }
    setSubmitting(true);
    setResult(null);

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/site/tahsilat${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          dues_ledger_id: entry.id,
          amount_kurus: Math.round(amount * 100),
          card_holder: cardHolder,
          card_number_masked: cardMasked,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setResult({ kind: "err", text: d.error || "İşlem başarısız." });
      } else {
        setResult({
          kind: "ok",
          text: `✓ Ödeme alındı — ${d.transaction_id}${d.is_paid ? " · Aidat tamamen ödendi" : " · Kısmi ödeme"}`,
        });
        window.setTimeout(() => onSuccess(), 1500);
      }
    } catch {
      setResult({ kind: "err", text: "Bağlantı hatası." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-3 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Ödeme Al — DEMO</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Daire</span>
            <span className="font-semibold">{entry.unit_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Dönem</span>
            <span className="font-semibold">{formatPeriod(entry.period)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Toplam Borç</span>
            <span className="font-semibold">{formatTL(entry.owed_tl)}</span>
          </div>
        </div>

        <Field label="Tutar (₺)" value={amountTL} onChange={setAmountTL} type="number" />
        <Field label="Kart Sahibi (demo)" value={cardHolder} onChange={setCardHolder} />
        <Field label="Kart Numarası (masked)" value={cardMasked} onChange={setCardMasked} />

        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
          ⚠ Mock provider — gerçek kart çekimi yapılmaz. Her zaman başarılı döner.
        </p>

        {result && (
          <div
            className={`rounded-xl p-3 text-sm ${
              result.kind === "ok"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
            }`}
          >
            {result.text}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2"><RotateCw className="w-4 h-4 animate-spin" /> İşleniyor</span>
          ) : (
            "Ödemeyi Onayla (DEMO)"
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition text-sm"
      />
    </div>
  );
}
