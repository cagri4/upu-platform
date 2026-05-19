"use client";

/**
 * Bayi Davet Modal — controlled signup flow.
 *
 * Dağıtıcı panel'den bayinin telefon + isim + mağaza adı (+ opsiyonel adres,
 * vergi no, not) bilgilerini girer, sistem WA mesajı + accept link gönderir.
 */

import { useState } from "react";
import { X, Loader2, CheckCircle2, Copy, MessageCircle, Smartphone, Check } from "lucide-react";

interface BayiDavetModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SuccessResult {
  invite_code: string;
  accept_url: string;
  share_message: string;
  share_phone: string;
}

export function BayiDavetModal({ open, onClose, onSuccess }: BayiDavetModalProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function resetForm() {
    setPhone("");
    setName("");
    setStoreName("");
    setStoreAddress("");
    setTaxNo("");
    setNote("");
    setError("");
    setSuccess(null);
    setCopied(false);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sessiz */
    }
  }

  function handleWhatsApp(phoneDigits: string, message: string) {
    window.open(
      `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
  }

  function handleSms(phoneDigits: string, message: string) {
    window.location.href = `sms:+${phoneDigits}?body=${encodeURIComponent(message)}`;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/bayi-davet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          store_name: storeName.trim(),
          store_address: storeAddress.trim() || null,
          tax_no: taxNo.trim() || null,
          note: note.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Davet oluşturulamadı.");
        return;
      }
      setSuccess({
        invite_code: d.invite_code,
        accept_url: d.accept_url,
        share_message: d.share_message,
        share_phone: d.share_phone,
      });
      if (onSuccess) onSuccess();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {success ? "Davet Gönderildi" : "+ Bayi Davet Et"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {success ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 flex-shrink-0" strokeWidth={2} />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Davet hazır.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Aşağıdan bayiye iletmek istediğiniz kanalı seçin.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Davet Kodu</p>
                <p className="font-mono text-base text-slate-900 dark:text-white">{success.invite_code}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Accept Link</p>
                <p className="font-mono text-xs text-slate-900 dark:text-white break-all">{success.accept_url}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCopy(success.accept_url)}
                className="flex flex-col items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 active:scale-95 transition rounded-xl py-3"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
                ) : (
                  <Copy className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
                )}
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {copied ? "Kopyalandı" : "Kopyala"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleWhatsApp(success.share_phone, success.share_message)}
                className="flex flex-col items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition rounded-xl py-3 text-white"
              >
                <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
                <span className="text-[11px] font-medium">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleSms(success.share_phone, success.share_message)}
                className="flex flex-col items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded-xl py-3 text-white"
              >
                <Smartphone className="w-5 h-5" strokeWidth={2.2} />
                <span className="text-[11px] font-medium">SMS</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => { resetForm(); }}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-sm font-semibold"
            >
              Yeni Davet Oluştur
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-2 text-sm font-medium"
            >
              Kapat
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <Field label="Telefon (90 ile başlayan)" required>
              <input
                type="tel"
                required
                placeholder="905XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>
            <Field label="İsim Soyisim" required>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>
            <Field label="Mağaza Adı" required>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>
            <Field label="Mağaza Adresi (opsiyonel)">
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>
            <Field label="Vergi No (opsiyonel)">
              <input
                type="text"
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>
            <Field label="Not (sadece sizin için)">
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </Field>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Gönderiliyor…" : "Davet Et"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
