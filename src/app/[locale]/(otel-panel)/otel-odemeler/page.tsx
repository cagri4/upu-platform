"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Plus, X, Loader2, Receipt, ExternalLink, FileText, Check, AlertTriangle, RotateCcw } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  description: string | null;
  created_at: string;
  otel_reservations: { guest_name: string; check_in: string; check_out: string } | null;
}

interface Invoice {
  id: string;
  reservation_id: string;
  invoice_type: string;
  status: string;
  invoice_number: string | null;
  invoice_uuid: string | null;
  pdf_url: string | null;
  total_amount: number | null;
  is_mock: boolean;
  error_message: string | null;
  accepted_at: string | null;
  created_at: string;
  otel_reservations: { guest_name: string; check_in: string; check_out: string } | null;
}

interface Rez {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  total_price: number | null;
  status: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Bekliyor",     cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  open:      { label: "Ödeme aç.",    cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  paid:      { label: "Ödendi",       cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  canceled:  { label: "İptal",        cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
  expired:   { label: "Süresi doldu", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
  failed:    { label: "Hata",         cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
  refunded:  { label: "İade edildi",  cls: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300" },
};

const INV_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Taslak",       cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
  sent:      { label: "Gönderildi",   cls: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300" },
  accepted:  { label: "Kabul edildi", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  rejected:  { label: "Reddedildi",   cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
  failed:    { label: "Hata",         cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

const PROVIDER_LABEL: Record<string, string> = {
  mollie: "Mollie",
  manual_iban: "IBAN/Havale",
  cash: "Nakit",
  iyzico: "iyzico",
};

const TYPE_LABEL: Record<string, string> = {
  deposit: "Kapora",
  full: "Tam ödeme",
  partial: "Kısmi ödeme",
  refund: "İade",
};

function fmtTRY(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function OtelOdemelerPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [tab, setTab] = useState<"payments" | "invoices">("payments");
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [reservations, setReservations] = useState<Rez[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadPayments = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/payments${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setPayments(d.payments || []))
      .catch(() => setPayments([]));
  };

  const reloadInvoices = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/invoices${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setInvoices(d.invoices || []))
      .catch(() => setInvoices([]));
  };

  useEffect(() => {
    reloadPayments();
    reloadInvoices();
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/list-reservations${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setReservations(d.reservations || []))
      .catch(() => {});
  }, [token]);

  const doPaymentAction = async (id: string, action: "mark_paid" | "cancel" | "refund") => {
    setActionId(id);
    setError(null);
    try {
      const body: any = { action };
      if (token) body.token = token;
      const r = await fetch(`/api/otel-panel/payments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else reloadPayments();
    } finally {
      setActionId(null);
    }
  };

  const totalPaid = (payments || [])
    .filter(p => p.status === "paid" && p.payment_type !== "refund")
    .reduce((s, p) => s + Number(p.amount), 0)
    - (payments || []).filter(p => p.status === "paid" && p.payment_type === "refund")
      .reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = (payments || [])
    .filter(p => p.status === "pending" || p.status === "open")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Tahsilat"
        subtitle="Mollie online ödemeler, IBAN/havale takibi, nakit kayıtları ve e-Arşiv faturalandırma. e-Fatura entegratör hesabı gelene kadar MOCK modda fatura kesilir."
        Icon={CreditCard}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtTRY(totalPaid)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Toplam tahsilat</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtTRY(totalPending)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Bekleyen ödemeler</div>
        </div>
      </div>

      <div className="flex justify-between gap-3 items-center">
        <div className="flex gap-2">
          <button onClick={() => setTab("payments")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              tab === "payments" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
            }`}>
            <CreditCard className="w-3 h-3 inline mr-1" /> Ödemeler
          </button>
          <button onClick={() => setTab("invoices")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              tab === "invoices" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
            }`}>
            <Receipt className="w-3 h-3 inline mr-1" /> Faturalar
          </button>
        </div>
        <button
          onClick={() => tab === "payments" ? setShowPaymentModal(true) : setShowInvoiceModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> {tab === "payments" ? "Yeni ödeme" : "Yeni fatura"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>
      )}

      {tab === "payments" && (
        <>
          {payments === null && (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
          )}
          {payments?.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
              <p className="text-sm text-slate-600 dark:text-slate-400">Henüz ödeme kaydı yok.</p>
            </div>
          )}
          {payments && payments.length > 0 && (
            <div className="space-y-2">
              {payments.map(p => {
                const meta = STATUS_META[p.status] || { label: p.status, cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
                const rez = p.otel_reservations;
                return (
                  <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{rez?.guest_name || "—"}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{TYPE_LABEL[p.payment_type] || p.payment_type}</span>
                          <span className="text-[11px] text-slate-500">{PROVIDER_LABEL[p.provider] || p.provider}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {rez && <>{rez.check_in} → {rez.check_out} · </>}
                          {new Date(p.created_at).toLocaleDateString("tr-TR")}
                          {p.description && <span className="ml-2 italic">{p.description}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtTRY(Number(p.amount))}</div>
                        <div className="flex gap-1">
                          {p.checkout_url && p.status === "open" && (
                            <a href={p.checkout_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40">
                              <ExternalLink className="w-3 h-3" /> Mollie
                            </a>
                          )}
                          {(p.provider === "manual_iban") && p.status === "pending" && (
                            <button onClick={() => doPaymentAction(p.id, "mark_paid")} disabled={actionId === p.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50">
                              {actionId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Geldi
                            </button>
                          )}
                          {(p.status === "pending" || p.status === "open") && (
                            <button onClick={() => { if (confirm("Bu ödeme iptal edilsin mi?")) doPaymentAction(p.id, "cancel"); }} disabled={actionId === p.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-medium hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {p.status === "paid" && p.payment_type !== "refund" && (
                            <button onClick={() => { if (confirm("Bu ödeme iade edilsin mi?")) doPaymentAction(p.id, "refund"); }} disabled={actionId === p.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[11px] font-medium hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50">
                              <RotateCcw className="w-3 h-3" /> İade
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "invoices" && (
        <>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>MOCK MOD:</strong> Faturalar gerçek entegratöre gitmiyor. Entegratör hesabı + mali müşavir onayı gelince canlıya alınır.
            </p>
          </div>
          {invoices === null && (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
          )}
          {invoices?.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center shadow-sm">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
              <p className="text-sm text-slate-600 dark:text-slate-400">Henüz fatura yok.</p>
            </div>
          )}
          {invoices && invoices.length > 0 && (
            <div className="space-y-2">
              {invoices.map(inv => {
                const meta = INV_STATUS_META[inv.status] || { label: inv.status, cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
                const rez = inv.otel_reservations;
                return (
                  <div key={inv.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{rez?.guest_name || "—"}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">{inv.invoice_type.replace("_", "-")}</span>
                          {inv.is_mock && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">MOCK</span>}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {inv.invoice_number && <span className="font-mono">{inv.invoice_number}</span>}
                          {rez && <> · {rez.check_in} → {rez.check_out}</>}
                        </div>
                        {inv.error_message && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">⚠ {inv.error_message}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {inv.total_amount && <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtTRY(Number(inv.total_amount))}</div>}
                        {inv.pdf_url && (
                          <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                            <FileText className="w-3 h-3" /> PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showPaymentModal && (
        <PaymentModal token={token} reservations={reservations}
          onClose={() => setShowPaymentModal(false)}
          onCreated={() => { setShowPaymentModal(false); reloadPayments(); }} />
      )}
      {showInvoiceModal && (
        <InvoiceModal token={token} reservations={reservations}
          onClose={() => setShowInvoiceModal(false)}
          onCreated={() => { setShowInvoiceModal(false); reloadInvoices(); }} />
      )}
    </div>
  );
}

function PaymentModal({ token, reservations, onClose, onCreated }: {
  token: string | null;
  reservations: Rez[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rezId, setRezId] = useState(reservations[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"deposit" | "full" | "partial">("deposit");
  const [provider, setProvider] = useState<"mollie" | "manual_iban" | "cash">("mollie");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!rezId && reservations.length > 0) setRezId(reservations[0].id); }, [reservations, rezId]);

  const selectedRez = reservations.find(r => r.id === rezId);
  useEffect(() => {
    if (selectedRez?.total_price && !amount) {
      if (paymentType === "deposit") {
        setAmount(String(Math.round(Number(selectedRez.total_price) * 0.3)));
      } else if (paymentType === "full") {
        setAmount(String(selectedRez.total_price));
      }
    }
  }, [selectedRez, paymentType, amount]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = {
        reservation_id: rezId,
        amount: Number(amount),
        payment_type: paymentType,
        provider,
        description: description || undefined,
      };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Yeni Ödeme</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Rezervasyon *</span>
          <select required value={rezId} onChange={e => setRezId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {reservations.length === 0 && <option value="">Önce rez ekleyin</option>}
            {reservations.map(r => <option key={r.id} value={r.id}>{r.guest_name} — {r.check_in}{r.total_price ? ` (${r.total_price} ₺)` : ""}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Ödeme tipi</span>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value as any)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="deposit">Kapora (%30)</option>
              <option value="full">Tam ödeme</option>
              <option value="partial">Kısmi</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Yöntem</span>
            <select value={provider} onChange={e => setProvider(e.target.value as any)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="mollie">Mollie (online)</option>
              <option value="manual_iban">IBAN/Havale</option>
              <option value="cash">Nakit</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tutar (₺) *</span>
          <input type="number" required min={1} step={10} value={amount} onChange={e => setAmount(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Açıklama</span>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        {error && <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting || reservations.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Oluştur
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoiceModal({ token, reservations, onClose, onCreated }: {
  token: string | null;
  reservations: Rez[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rezId, setRezId] = useState(reservations[0]?.id || "");
  const [invoiceType, setInvoiceType] = useState<"e_fatura" | "e_arsiv">("e_arsiv");
  const [customerName, setCustomerName] = useState("");
  const [vkn, setVkn] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [address, setAddress] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!rezId && reservations.length > 0) setRezId(reservations[0].id); }, [reservations, rezId]);
  const selectedRez = reservations.find(r => r.id === rezId);
  useEffect(() => {
    if (selectedRez) {
      setCustomerName(c => c || selectedRez.guest_name || "");
      setTotalAmount(t => t || (selectedRez.total_price ? String(selectedRez.total_price) : ""));
    }
  }, [selectedRez]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = {
        reservation_id: rezId,
        invoice_type: invoiceType,
        customer_name: customerName,
        customer_vkn_or_tckn: vkn || undefined,
        customer_email: emailAddr || undefined,
        customer_address: address || undefined,
        total_amount: Number(totalAmount),
      };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Yeni Fatura (MOCK)</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Rezervasyon *</span>
          <select required value={rezId} onChange={e => setRezId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {reservations.map(r => <option key={r.id} value={r.id}>{r.guest_name} — {r.check_in}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tip</span>
            <select value={invoiceType} onChange={e => setInvoiceType(e.target.value as any)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="e_arsiv">e-Arşiv</option>
              <option value="e_fatura">e-Fatura</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tutar (KDV dahil) *</span>
            <input type="number" required min={1} value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Müşteri adı / Ünvan *</span>
          <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">VKN (10) / TCKN (11) {invoiceType === "e_fatura" ? "*" : ""}</span>
          <input type="text" value={vkn} onChange={e => setVkn(e.target.value.replace(/\D/g, "").slice(0, 11))}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">E-posta</span>
            <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Adres</span>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
        {error && <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting || reservations.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Kes
          </button>
        </div>
      </form>
    </div>
  );
}
