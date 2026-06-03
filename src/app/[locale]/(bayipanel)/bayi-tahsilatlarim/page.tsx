"use client";

/**
 * /tr/bayi-tahsilatlarim — Tahsilat (manuel kayıt akışı).
 *
 * Bayi: kendi ödemeleri + "Yeni Ödeme Kaydet" buton (form modal).
 * Admin/muhasebe: tüm tenant ödemeleri + Onayla/Reddet aksiyonları.
 *
 * Yeni endpoint /api/bayi-payments/* kullanılır (eski bayi-fatura/init
 * dokunulmadı, WA bot için duruyor olabilir).
 */

import { useEffect, useState, useCallback } from "react";
import { Wallet, Plus, Download, CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";
import { EmptyState } from "@/components/ui/EmptyState";
import { kurucuSecondary } from "@/components/empty-state-kurucu-link";

interface Payment {
  id: string;
  dealer_user_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  dekont_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  dealer_name: string | null;
}

const STATUS_BADGE: Record<Payment["status"], { label: string; cls: string }> = {
  pending:  { label: "Bekliyor", cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  approved: { label: "Onaylandı", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Reddedildi", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" },
};

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function TahsilatlarimPage() {
  const [me, setMe] = useState<{ role: string | null } | null>(null);
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bayi-panel/me", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.success) setMe({ role: d.role }); })
      .catch(() => {});
  }, []);

  const refetch = useCallback(() => {
    if (!me) return;
    const isAdmin = ["admin", "muhasebe"].includes(me.role || "");
    const scope = isAdmin ? "tenant" : "mine";
    setLoading(true);
    fetch(`/api/bayi-payments/list?scope=${scope}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        setRows(d.rows || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [me]);

  useEffect(() => { refetch(); }, [refetch]);

  const isAdmin = me && ["admin", "muhasebe"].includes(me.role || "");
  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  async function approve(id: string) {
    setActingId(id);
    try {
      const r = await fetch(`/api/bayi-payments/${id}/approve`, { method: "POST", credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Onaylanamadı."); return; }
      refetch();
    } finally { setActingId(null); }
  }
  async function reject(id: string) {
    const reason = window.prompt("Red sebebi:") || "";
    setActingId(id);
    try {
      const r = await fetch(`/api/bayi-payments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Reddedilemedi."); return; }
      refetch();
    } finally { setActingId(null); }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={Wallet} title="Tahsilatlar" subtitle={isAdmin ? "Bekleyen ödemeleri onayla veya reddet." : "Verdiğin ödemeler ve onay durumları."} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                filter === f
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {f === "all" ? "Tümü" : STATUS_BADGE[f].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <a href="/api/bayi-export/payments" target="_blank" rel="noopener" className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          {!isAdmin && (
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Yeni Ödeme
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <EmptyState
            icon={Wallet}
            title={filter === "all" ? "Henüz tahsilat yok" : `${filter === "pending" ? "Bekleyen" : filter === "approved" ? "Onaylanmış" : "Reddedilmiş"} tahsilat yok`}
            description={filter === "all"
              ? "İlk ödemeni 'Yeni Ödeme Kaydet' ile gir — dekont fotoğrafıyla birlikte. Admin onayından sonra cari ekstreye işlenir."
              : "Bu sekmede şu an kayıt yok. Filtreyi 'Tümü'ne çevirip kontrol edebilirsin."
            }
            secondary={kurucuSecondary("empty-state:bayi-tahsilatlarim")}
            accent="emerald"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const b = STATUS_BADGE[p.status];
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{p.dealer_name || "Sen"}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                    </div>
                    <div className="text-xs text-slate-500">Ödeme: {fmtDate(p.payment_date)} · Bildirim: {fmtDate(p.created_at)}</div>
                    {p.notes && <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Not: {p.notes}</div>}
                    {p.rejection_reason && <div className="text-xs text-rose-600 mt-1">Sebep: {p.rejection_reason}</div>}
                    {p.dekont_url && (
                      <a href={p.dekont_url} target="_blank" rel="noopener" className="text-[11px] text-indigo-600 hover:underline">📄 Dekont</a>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-slate-900 dark:text-white">{fmtTRY(p.amount)}</div>
                  </div>
                </div>
                {isAdmin && p.status === "pending" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" disabled={actingId === p.id} onClick={() => approve(p.id)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                      {actingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Onayla
                    </button>
                    <button type="button" disabled={actingId === p.id} onClick={() => reject(p.id)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60">
                      <XCircle className="w-3.5 h-3.5" /> Reddet
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && <AddPaymentModal onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); refetch(); }} />}
    </div>
  );
}

function AddPaymentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dekontUrl, setDekontUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/bayi-payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          amount: Number(amount),
          payment_date: date,
          dekont_url: dekontUrl.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kaydedilemedi."); return; }
      onCreated();
    } catch {
      setError("Bağlantı hatası.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Yeni Ödeme</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </header>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Tutar (TL) *</label>
            <input type="number" required min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Ödeme Tarihi *</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Dekont URL (opsiyonel)</label>
            <input type="url" value={dekontUrl} onChange={(e) => setDekontUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
            <p className="text-[11px] text-slate-500 mt-1">Dekont PDF'ini Drive/Dropbox'a yükleyip linkini yapıştırın.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Açıklama</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hangi fatura için, banka adı, vb." className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-sm text-rose-700">⚠️ {error}</div>}
          <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Gönderiliyor…" : "Ödeme Bildirimi Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}
