"use client";

/**
 * /tr/bayi-faturalarim — Fatura listesi (bayi kendi, admin/muhasebe tüm).
 *
 * Admin/muhasebe: "+ Yeni Fatura" form modal (bayi seç + no + tarihler +
 * tutar + PDF URL + not). PDF dosyası storage'a upload yerine pragmatik
 * MVP: PDF URL field (Google Drive/Dropbox link paste).
 *
 * Tüm görünüm: ödendi/açık/vadesi geçti badge + mark-paid aksiyonu
 * (admin/muhasebe).
 */

import { useEffect, useState, useCallback } from "react";
import { Receipt, Plus, Download, Loader2, X, FileText } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface InvoiceRow {
  id: string;
  invoice_no: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: "open" | "paid" | "overdue" | "cancelled";
  effective_status: string;
  pdf_url: string | null;
  notes: string | null;
  dealer_user_id: string;
  dealer_name: string | null;
  days_to_due: number;
}

interface Dealer { id: string; name: string }

const BADGE: Record<string, { label: string; cls: string }> = {
  open:      { label: "Açık",        cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700" },
  paid:      { label: "Ödendi",      cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700" },
  overdue:   { label: "Vadesi Geçti", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 font-semibold" },
  cancelled: { label: "İptal",       cls: "bg-slate-100 dark:bg-slate-800 text-slate-600" },
};

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function BayiFaturalarimPage() {
  const [me, setMe] = useState<{ role: string | null } | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "paid" | "overdue">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bayi-panel/me", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.success) setMe({ role: d.role }); })
      .catch(() => {});
  }, []);

  const isAdmin = me && ["admin", "muhasebe"].includes(me.role || "");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/bayiler/list?pageSize=200", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setDealers((d.rows || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, [isAdmin]);

  const refetch = useCallback(() => {
    if (!me) return;
    const scope = isAdmin ? "tenant" : "mine";
    setLoading(true);
    fetch(`/api/bayi-invoices/list?scope=${scope}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı.");
        setRows(d.rows || []);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [me, isAdmin]);

  useEffect(() => { refetch(); }, [refetch]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.effective_status === filter);

  async function markPaid(id: string) {
    if (!confirm("Fatura ödendi olarak işaretlensin mi?")) return;
    setActingId(id);
    try {
      const r = await fetch(`/api/bayi-invoices/${id}/mark-paid`, { method: "POST", credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Güncellenemedi."); return; }
      refetch();
    } finally { setActingId(null); }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={Receipt} title="Faturalar" subtitle={isAdmin ? "Bayi faturalarını yönet, vade takibi yap." : "Hesabınıza kesilen faturalar."} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(["all", "open", "overdue", "paid"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                filter === f ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {f === "all" ? "Tümü" : BADGE[f].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <a href="/api/bayi-export/invoices" target="_blank" rel="noopener" className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          {isAdmin && (
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Yeni Fatura
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500">
          Bu filtrede fatura yok.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const b = BADGE[r.effective_status] || BADGE.open;
            return (
              <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.invoice_no}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                      {r.effective_status === "open" && r.days_to_due >= 0 && r.days_to_due < 7 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{r.days_to_due} gün kaldı</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.dealer_name && <span>{r.dealer_name} · </span>}
                      Düzenleme: {fmtDate(r.issue_date)} · Vade: {fmtDate(r.due_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtTRY(r.amount)}</div>
                    {r.pdf_url && (
                      <a href={r.pdf_url} target="_blank" rel="noopener" className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PDF
                      </a>
                    )}
                  </div>
                </div>
                {isAdmin && (r.effective_status === "open" || r.effective_status === "overdue") && (
                  <button type="button" disabled={actingId === r.id} onClick={() => markPaid(r.id)} className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                    {actingId === r.id ? "..." : "✓ Ödendi İşaretle"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && isAdmin && (
        <AddInvoiceModal dealers={dealers} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); refetch(); }} />
      )}
    </div>
  );
}

function AddInvoiceModal({ dealers, onClose, onCreated }: { dealers: Dealer[]; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const plus30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [dealerId, setDealerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(plus30);
  const [amount, setAmount] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/bayi-invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          dealer_user_id: dealerId,
          invoice_no: invoiceNo.trim(),
          issue_date: issueDate,
          due_date: dueDate,
          amount: Number(amount),
          pdf_url: pdfUrl.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kaydedilemedi."); return; }
      onCreated();
    } catch { setError("Bağlantı hatası."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Yeni Fatura</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </header>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Bayi *</label>
            <select required value={dealerId} onChange={(e) => setDealerId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800">
              <option value="">— Seçin —</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Fatura No *</label>
            <input type="text" required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="2026-001" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1">Düzenleme *</label>
              <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Vade *</label>
              <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Tutar (TL) *</label>
            <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">PDF URL (opsiyonel)</label>
            <input type="url" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Not</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800" />
          </div>
          {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-sm text-rose-700">⚠️ {error}</div>}
          <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Kaydediliyor…" : "Fatura Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
