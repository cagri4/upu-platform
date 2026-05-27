"use client";

/**
 * QR'dan gelen müşteri için üst sticky aksiyon bar.
 *
 * 2 buton — Butlaroo paterni:
 *   🛎 Garson Çağır → reason modal (call/complaint/other)
 *   💳 Hesap İste   → tek tık (reason='bill_request')
 *
 * Çağrı başarılı: toast feedback + 120sn cooldown göster.
 * Çağrı 429 (rate limit): "Çağrınız işleniyor, 2dk içinde yeniden deneyin"
 */
import { useState } from "react";
import { Bell, Receipt, X, Check } from "lucide-react";
import type { TableContext } from "./table-context";

type Status = "idle" | "submitting" | "success" | "error";

export function TableActionsBar({
  slug,
  primaryColor,
  tableContext,
}: {
  slug: string;
  primaryColor: string;
  tableContext: TableContext;
}) {
  const [reasonModal, setReasonModal] = useState<"call" | "bill_request" | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("success");

  async function submit(reason: "call" | "bill_request", subReason?: string, notes?: string) {
    setStatus("submitting");
    try {
      const res = await fetch(`/api/r/${slug}/tables/${tableContext.qrToken}/call-waiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: subReason || reason, notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setFeedbackKind("error");
        setFeedback(json.error || "Çağrı gönderilemedi.");
      } else {
        setStatus("success");
        setFeedbackKind("success");
        setFeedback(
          reason === "bill_request"
            ? `Hesap istendi · Masa ${tableContext.tableLabel}`
            : `Garson çağrıldı · Masa ${tableContext.tableLabel}`,
        );
      }
    } catch {
      setStatus("error");
      setFeedbackKind("error");
      setFeedback("Bağlantı hatası, tekrar deneyin.");
    } finally {
      setReasonModal(null);
      // 5 saniye sonra feedback temizle
      setTimeout(() => {
        setFeedback(null);
        setStatus("idle");
      }, 5000);
    }
  }

  return (
    <>
      <div className="px-4 pt-3 pb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setReasonModal("call")}
          disabled={status === "submitting"}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          <Bell className="w-4 h-4" strokeWidth={2.4} />
          Garson Çağır
        </button>
        <button
          type="button"
          onClick={() => submit("bill_request")}
          disabled={status === "submitting"}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100 shadow-sm active:scale-[0.98] transition disabled:opacity-50"
        >
          <Receipt className="w-4 h-4" strokeWidth={2.4} />
          Hesap İste
        </button>
      </div>

      {feedback && (
        <div
          className={`mx-4 mb-2 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
            feedbackKind === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedbackKind === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.4} />
          ) : (
            <X className="w-4 h-4 flex-shrink-0" strokeWidth={2.4} />
          )}
          <span>{feedback}</span>
        </div>
      )}

      {reasonModal === "call" && (
        <ReasonModal
          tableLabel={tableContext.tableLabel}
          primaryColor={primaryColor}
          onClose={() => setReasonModal(null)}
          onSubmit={(subReason, notes) => submit("call", subReason, notes)}
        />
      )}
    </>
  );
}

function ReasonModal({
  tableLabel,
  primaryColor,
  onClose,
  onSubmit,
}: {
  tableLabel: string;
  primaryColor: string;
  onClose: () => void;
  onSubmit: (reason: string, notes?: string) => void;
}) {
  const [reason, setReason] = useState<"call" | "complaint" | "other">("call");
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Masa {tableLabel} — Garson Çağır
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-2">
            <ReasonChoice
              checked={reason === "call"}
              onChange={() => setReason("call")}
              primaryColor={primaryColor}
              label="Sipariş vereceğim"
              hint="Garson masaya gelsin"
            />
            <ReasonChoice
              checked={reason === "complaint"}
              onChange={() => setReason("complaint")}
              primaryColor={primaryColor}
              label="Şikayet / sorun var"
              hint="Yöneticiye iletilir"
            />
            <ReasonChoice
              checked={reason === "other"}
              onChange={() => setReason("other")}
              primaryColor={primaryColor}
              label="Başka"
              hint="Detayı not olarak yazabilirsiniz"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Not (opsiyonel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="örn. çatal eksik, kola sıcak"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
              maxLength={120}
            />
          </div>

          <button
            type="button"
            onClick={() => onSubmit(reason, notes.trim() || undefined)}
            className="w-full text-white font-bold px-5 py-3 rounded-2xl shadow-sm hover:opacity-95 active:scale-[0.98] transition"
            style={{ backgroundColor: primaryColor }}
          >
            Çağır
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonChoice({
  checked,
  onChange,
  primaryColor,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  primaryColor: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${
        checked
          ? "border-2 bg-slate-50 dark:bg-slate-800"
          : "border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
      style={checked ? { borderColor: primaryColor } : undefined}
    >
      <span
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition ${
          checked ? "" : "border-slate-300 dark:border-slate-600"
        }`}
        style={checked ? { borderColor: primaryColor } : undefined}
      >
        {checked && (
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>
      </span>
    </button>
  );
}
