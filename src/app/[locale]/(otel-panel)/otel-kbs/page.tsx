"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, RefreshCw, Send, AlertTriangle, CheckCircle2, Clock, XCircle, Loader2, Trash2 } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Submission {
  id: string;
  reservation_id: string;
  status: string;
  kbs_reference: string | null;
  is_mock: boolean;
  error_message: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  otel_reservations: {
    guest_name: string;
    check_in: string;
    check_out: string;
    otel_rooms: { name?: string } | null;
  } | null;
}

interface Rez {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
}

const STATUS_META: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:  { label: "Bekleniyor",   cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",     Icon: Clock },
  sent:     { label: "Gönderildi",   cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300",         Icon: Send },
  accepted: { label: "Kabul edildi", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
  rejected: { label: "Reddedildi",   cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",         Icon: XCircle },
  failed:   { label: "Hata",         cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",         Icon: AlertTriangle },
};

export default function OtelKbsPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [reservations, setReservations] = useState<Rez[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [submittingRez, setSubmittingRez] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/kbs${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setSubmissions(d.submissions || []))
      .catch(() => setSubmissions([]));
  };

  useEffect(() => {
    reload();
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-reservations${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setReservations(d.reservations || []))
      .catch(() => {});
  }, [token]);

  const submitForRez = async (rezId: string) => {
    setSubmittingRez(rezId);
    setError(null);
    try {
      const body: any = { reservation_id: rezId };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/kbs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reload();
    } finally {
      setSubmittingRez(null);
    }
  };

  const resubmit = async (subId: string) => {
    setActionId(subId);
    setError(null);
    try {
      const body: any = {};
      if (token) body.token = token;
      const r = await fetch(`/api/otel-panel/kbs/${subId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (subId: string) => {
    if (!confirm("Bu KBS kaydı silinsin mi?")) return;
    setActionId(subId);
    setError(null);
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/otel-panel/kbs/${subId}${qs}`, { method: "DELETE", credentials: "same-origin" });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reload();
    } finally {
      setActionId(null);
    }
  };

  const submittedRezIds = new Set((submissions || []).filter(s => s.status === "accepted" || s.status === "pending" || s.status === "sent").map(s => s.reservation_id));
  const eligibleRezs = reservations.filter(r =>
    (r.status === "confirmed" || r.status === "checked_in") && !submittedRezIds.has(r.id)
  );

  const filtered = (submissions ?? []).filter(s => filter === "all" ? true : s.status === filter);

  const counts = {
    pending:  (submissions || []).filter(s => s.status === "pending" || s.status === "sent").length,
    accepted: (submissions || []).filter(s => s.status === "accepted").length,
    rejected: (submissions || []).filter(s => s.status === "rejected" || s.status === "failed").length,
  };

  return (
    <div className="space-y-5">
      <HeroBanner
        title="KBS — Konaklama Bildirimi"
        subtitle="Polis Genel Müdürlüğü Konaklama Bildirim Sistemi gönderimleri. Şu an MOCK modda — gerçek entegrasyon için Caretta hesabı + tesis kodu gerekir."
        Icon={Shield}
      />

      {/* Mock uyarısı */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>MOCK MOD:</strong> Tüm gönderimler simüle edilir — gerçek KBS&apos;ye veri gitmez. Tesis kodu + güvenli kimlik tanımlanınca canlıya geçilir.
        </p>
      </div>

      {/* KPI özet */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{counts.pending}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Beklemede / gönderildi</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.accepted}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Kabul edildi</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{counts.rejected}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Reddedildi / hata</div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* KBS bildirimi yapılmamış rezervasyonlar */}
      {eligibleRezs.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Bildirim Bekleyenler ({eligibleRezs.length})
          </h3>
          <div className="space-y-2">
            {eligibleRezs.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.guest_name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{r.check_in} → {r.check_out}</div>
                </div>
                <button
                  onClick={() => submitForRez(r.id)}
                  disabled={submittingRez === r.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
                >
                  {submittingRez === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  KBS'ye gönder
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gönderimler */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: "Tümü" },
          { key: "pending", label: "Beklemede" },
          { key: "accepted", label: "Kabul" },
          { key: "rejected", label: "Ret" },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f.key
                ? "bg-emerald-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {submissions === null && (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      )}

      {submissions?.length === 0 && eligibleRezs.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
          <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400">Henüz KBS gönderimi yok.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(s => {
            const meta = STATUS_META[s.status] || STATUS_META.pending;
            const Icon = meta.Icon;
            const rez = s.otel_reservations;
            const room = rez?.otel_rooms?.name || "—";
            return (
              <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{rez?.guest_name || "—"}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${meta.cls}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      {s.is_mock && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">MOCK</span>}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{rez?.check_in} → {rez?.check_out}</span>
                      <span>Oda: {room}</span>
                      {s.kbs_reference && <span className="font-mono">Ref: {s.kbs_reference}</span>}
                    </div>
                    {s.error_message && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">⚠ {s.error_message}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(s.status === "rejected" || s.status === "failed") && (
                      <button
                        onClick={() => resubmit(s.id)}
                        disabled={actionId === s.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 disabled:opacity-50"
                      >
                        {actionId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Tekrar gönder
                      </button>
                    )}
                    {s.status !== "accepted" && (
                      <button
                        onClick={() => remove(s.id)}
                        disabled={actionId === s.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-[11px] font-medium hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
