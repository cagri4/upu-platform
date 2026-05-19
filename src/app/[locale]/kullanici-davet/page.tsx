"use client";

/**
 * /tr/kullanici-davet — Admin'in iç kullanıcı davet formu (WA-first paylaş).
 *
 * Eski capability-based davet (calisan-davet) yerine rol bazlı (admin/
 * muhasebe/depocu/satis) sistem. Bot otomatik mesaj göndermez —
 * /api/kullanici-davet/create invite_token + share_message üretir; admin
 * Kopyala/WA/SMS 3 paylaş butonuyla kendi WA'sından gönderir → kullanıcı
 * bot'a yazar, 24h customer service window açılır.
 *
 * Bayi panel (cookie session) içinde. Sadece admin role erişebilir
 * (BAYI_ROLE_REQUIREMENTS guard).
 */

import { useState } from "react";
import { Loader2, CheckCircle2, Copy, MessageCircle, Smartphone, Check, ArrowLeft } from "lucide-react";

interface SuccessResult {
  invite_token: string;
  role_label: string;
  accept_url: string;
  share_message: string;
  share_phone: string;
}

const ROLES = [
  { id: "admin",    label: "Yönetici", desc: "Tüm yetkiler — firma sahibi seviyesi" },
  { id: "muhasebe", label: "Muhasebe", desc: "Cari, fatura, tahsilat" },
  { id: "depocu",   label: "Depo",     desc: "Stok sayım, stok hareket" },
  { id: "satis",    label: "Satış",    desc: "Bayi ziyaret, sipariş, kampanya" },
];

export default function KullaniciDavetPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("satis");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/kullanici-davet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), role }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Davet oluşturulamadı.");
        return;
      }
      setSuccess({
        invite_token: d.invite_token,
        role_label: d.role_label,
        accept_url: d.accept_url,
        share_message: d.share_message,
        share_phone: d.share_phone,
      });
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setPhone("");
    setRole("satis");
    setError("");
    setSuccess(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.accept_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sessiz */
    }
  }

  function handleWhatsApp() {
    if (!success) return;
    window.open(
      `https://wa.me/${success.share_phone}?text=${encodeURIComponent(success.share_message)}`,
      "_blank",
      "noopener",
    );
  }

  function handleSms() {
    if (!success) return;
    window.location.href = `sms:+${success.share_phone}?body=${encodeURIComponent(success.share_message)}`;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-md p-6 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 flex-shrink-0" strokeWidth={2} />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Davet hazır</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Aşağıdan kullanıcıya iletmek istediğiniz kanalı seçin. Bot otomatik mesaj göndermez.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rol</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{success.role_label}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Accept Link</p>
              <p className="font-mono text-xs text-slate-900 dark:text-white break-all">{success.accept_url}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleCopy}
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
              onClick={handleWhatsApp}
              className="flex flex-col items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition rounded-xl py-3 text-white"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
              <span className="text-[11px] font-medium">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleSms}
              className="flex flex-col items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded-xl py-3 text-white"
            >
              <Smartphone className="w-5 h-5" strokeWidth={2.2} />
              <span className="text-[11px] font-medium">SMS</span>
            </button>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-sm font-semibold"
          >
            Yeni Davet
          </button>
          <a
            href="/tr/bayi-panel"
            className="block w-full text-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-2 text-sm font-medium"
          >
            🏠 Panele Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">👤</div>
          <h1 className="text-xl font-bold">Kullanıcı Davet</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Şirket içi yeni kullanıcı ekle. Rol seç — yetkiler otomatik atanır.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">İsim Soyisim *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ahmet Yılmaz"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Telefon (WhatsApp) *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="905XXXXXXXXX"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">Ülke kodu ile (10-15 hane).</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Rol *</label>
            <div className="space-y-1.5">
              {ROLES.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                    role === r.id
                      ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.id}
                    checked={role === r.id}
                    onChange={() => setRole(r.id)}
                    className="mt-1 w-4 h-4 accent-indigo-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{r.label}</div>
                    <div className="text-[11px] text-slate-500">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a
              href="/tr/bayi-panel"
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-semibold text-center active:scale-95 flex items-center justify-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Panele Dön
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95 flex items-center justify-center gap-1 text-sm"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Üretiliyor…" : "Davet Linki Üret"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
