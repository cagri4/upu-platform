"use client";

/**
 * /tr/davet/[code] — Davet kabul sayfası (iki paralel akış).
 *
 * Dynamic (type='dynamic'): dağıtıcı paneli "Manuel Bayi Ekle" form'undan
 *   üretilen davet — name/phone/store_name önceden dolu, bayi "Devam Et"
 *   ile onaylar. POST /api/bayi-davet/accept { code }.
 *
 * Static (type='static'): dağıtıcı evergreen statik link — bayi kendisi
 *   telefon + isim + (opt) mağaza adı doldurur, POST /api/bayi-davet/
 *   static-claim { slug, phone, name, store_name? }.
 *
 * Her iki akış da cookie session attach + /tr/bayi-panel'e yönlendirir.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface DynamicResp {
  ok: true;
  type: "dynamic";
  name: string;
  storeName: string;
  storeAddress: string | null;
  phone: string;
  distributorName: string;
  expiresAt: string;
}

interface StaticResp {
  ok: true;
  type: "static";
  slug: string;
  distributorName: string;
}

type ValidateResp = DynamicResp | StaticResp;

export default function DavetPage() {
  const params = useParams();
  const rawCode = String(params.code || "");
  const code = rawCode.trim();

  const [state, setState] = useState<"loading" | "ready" | "error" | "submitting" | "done">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<ValidateResp | null>(null);

  // Statik akış form state
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    if (!code) {
      setState("error");
      setError("Geçersiz davet kodu.");
      return;
    }
    fetch(`/api/bayi-davet/validate?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Davet doğrulanamadı.");
        setData(d as ValidateResp);
        setState("ready");
      })
      .catch((e) => {
        setError(e.message || "Bağlantı hatası.");
        setState("error");
      });
  }, [code]);

  async function handleAcceptDynamic() {
    setState("submitting");
    setError("");
    try {
      const r = await fetch("/api/bayi-davet/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code.toUpperCase() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Davet kabul edilemedi.");
        setState("error");
        return;
      }
      setState("done");
      window.location.href = d.redirect || "/tr/bayi-panel";
    } catch {
      setError("Bağlantı hatası.");
      setState("error");
    }
  }

  async function handleClaimStatic(e: React.FormEvent) {
    e.preventDefault();
    if (!data || data.type !== "static") return;
    setState("submitting");
    setError("");
    try {
      const r = await fetch("/api/bayi-davet/static-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          slug: data.slug,
          phone: phone.trim(),
          name: name.trim(),
          store_name: storeName.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Hesap oluşturulamadı.");
        setState("ready");
        return;
      }
      setState("done");
      window.location.href = d.redirect || "/tr/bayi-panel";
    } catch {
      setError("Bağlantı hatası.");
      setState("ready");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-md p-6 space-y-4">
        {state === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Davet doğrulanıyor…</p>
          </div>
        )}

        {state === "error" && !data && (
          <div className="text-center py-6">
            <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" strokeWidth={1.8} />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Davet Geçersiz</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        )}

        {data && data.type === "dynamic" && (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Hoş geldiniz!</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{data.distributorName} sizi davet etti</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <Row label="İsim" value={data.name} />
              <Row label="Mağaza" value={data.storeName} />
              {data.storeAddress && <Row label="Adres" value={data.storeAddress} />}
              <Row label="Telefon" value={data.phone} />
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
                ⚠️ {error}
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              &quot;Devam Et&quot; butonuna tıkladığınızda hesabınız aktifleşir ve bayi panelinize yönlendirilirsiniz.
            </p>

            <button
              type="button"
              onClick={handleAcceptDynamic}
              disabled={state === "submitting"}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {state === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
              {state === "submitting" ? "Hesap oluşturuluyor…" : "Devam Et"}
              {state !== "submitting" && <ArrowRight className="w-4 h-4" />}
            </button>
          </>
        )}

        {data && data.type === "static" && (
          <form onSubmit={handleClaimStatic} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Hoş geldiniz!</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">{data.distributorName}</span> sizi bayi olarak davet ediyor
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Telefon (WhatsApp)" required>
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
              <Field label="Mağaza Adı (opsiyonel)">
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Sonradan profilim sayfasından da doldurabilirsiniz"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                />
              </Field>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "submitting"}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {state === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
              {state === "submitting" ? "Hesap oluşturuluyor…" : "Hesabımı Oluştur"}
              {state !== "submitting" && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {state === "done" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Panele yönlendiriliyorsunuz…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white text-right break-words">{value || "—"}</span>
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
