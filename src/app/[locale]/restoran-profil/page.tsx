"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UtensilsCrossed,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { LoadingState } from "@/tenants/restoran/components/banking";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Form {
  display_name: string;
  restaurant_name: string;
  location: string;
  segment: "restoran" | "cafe" | "catering" | "tatlici";
  capacity: "kucuk" | "orta" | "buyuk";
  accounting: "yuki" | "exact" | "snelstart" | "other" | "none" | "";
  brifing_enabled: "evet" | "hayir";
}

const SEGMENT_LABELS: Record<Form["segment"], string> = {
  restoran: "Türk Restoranı (kebap, lahmacun, ızgara)",
  cafe: "Cafe / Kahvaltı",
  catering: "Catering / Düğün servisi",
  tatlici: "Tatlıcı / Fırın / Simitçi",
};

const CAPACITY_LABELS: Record<Form["capacity"], string> = {
  kucuk: "1-10 masa (küçük)",
  orta: "11-25 masa (orta)",
  buyuk: "26+ masa (büyük)",
};

const ACCOUNTING_LABELS: Record<NonNullable<Form["accounting"]>, string> = {
  yuki: "Yuki",
  exact: "Exact Online",
  snelstart: "SnelStart",
  other: "Diğer / kendi muhasebecim",
  none: "Henüz muhasebe yazılımı yok",
  "": "—",
};

export default function RestoranProfilPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("t") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    display_name: "",
    restaurant_name: "",
    location: "",
    segment: "restoran",
    capacity: "orta",
    accounting: "",
    brifing_enabled: "evet",
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Geçersiz veya eksik link.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/restoran-profil/init?t=${token}`);
        const json = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(json.error || "Link doğrulanamadı.");
          return;
        }
        if (json.profile) {
          const meta = json.profile.metadata || {};
          setForm((f) => ({
            ...f,
            display_name: json.profile.display_name || "",
            restaurant_name: meta.restaurant_name || "",
            location: meta.location || "",
            segment: meta.segment || meta.cuisine_type || "restoran",
            capacity: meta.capacity || "orta",
            accounting: meta.accounting_provider || "",
            brifing_enabled: meta.briefing_enabled === false ? "hayir" : "evet",
          }));
        }
        setStatus("ready");
      } catch {
        setStatus("error");
        setError("Bağlantı hatası.");
      }
    })();
  }, [token]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (form.display_name.trim().length < 2) {
      setError("Ad soyad gerekli (en az 2 karakter).");
      return;
    }
    if (form.restaurant_name.trim().length < 2) {
      setError("Restoran adı gerekli.");
      return;
    }
    if (form.location.trim().length < 2) {
      setError("Şehir/bölge gerekli.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/restoran-profil/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Kayıt başarısız.");
        setStatus("ready");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası, tekrar deneyin.");
    }
  }

  if (status === "loading") {
    return <LoadingState label="Profiliniz hazırlanıyor…" />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
            <AlertTriangle className="w-7 h-7" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Bir sorun var</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">{error || "Beklenmedik hata."}</p>
        </div>
      </div>
    );
  }

  if (status === "done") {
    const waUrl = `https://wa.me/${BOT_WA_NUMBER}?text=brifing`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Hoş geldiniz!</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">
            Profiliniz kaydedildi. Örnek restoran <b>Sultan Ahmet Kebabevi</b> verisi yüklendi —
            8 masa, 30 menü kalemi, 8 müdavim, bugün 4 rezervasyon.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            WhatsApp&apos;a dönün ve şu komutları sırayla deneyin:
            <br />
            <code className="text-amber-600 dark:text-amber-400">brifing</code> ·{" "}
            <code className="text-amber-600 dark:text-amber-400">rezervasyon</code> ·{" "}
            <code className="text-amber-600 dark:text-amber-400">sadakat</code> ·{" "}
            <code className="text-amber-600 dark:text-amber-400">menukalemleri</code>
          </p>
          <a
            href={waUrl}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-6 py-3 rounded-xl transition active:scale-95"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
            WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 text-white rounded-2xl p-5 sm:p-6 shadow-md">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Restoran Profili</h1>
              <p className="text-amber-50/95 text-sm mt-1.5 leading-relaxed">
                Sizi tanıyalım — 2-3 dakika sürer. Bilgileriniz örnek demo verisi
                ile birlikte panelinize hazırlanır.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-6 sm:p-7 space-y-5">
          <Field label="Ad soyad *">
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Mehmet Yılmaz"
              className={inputCls}
            />
          </Field>

          <Field label="Restoran/cafe adı *">
            <input
              type="text"
              value={form.restaurant_name}
              onChange={(e) => update("restaurant_name", e.target.value)}
              placeholder="Anadolu Sofrası"
              className={inputCls}
            />
          </Field>

          <Field label="Şehir / bölge *">
            <input
              type="text"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Rotterdam Centrum"
              className={inputCls}
            />
          </Field>

          <Field label="İşletme tipi *">
            <select
              value={form.segment}
              onChange={(e) => update("segment", e.target.value as Form["segment"])}
              className={inputCls}
            >
              {Object.entries(SEGMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Kapasite">
            <select
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value as Form["capacity"])}
              className={inputCls}
            >
              {Object.entries(CAPACITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Muhasebe yazılımı (opsiyonel)">
            <select
              value={form.accounting}
              onChange={(e) => update("accounting", e.target.value as Form["accounting"])}
              className={inputCls}
            >
              <option value="">Şimdilik boş bırak</option>
              {Object.entries(ACCOUNTING_LABELS)
                .filter(([k]) => k !== "")
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </select>
          </Field>

          <Field label="Sabah brifingi">
            <div className="flex gap-3">
              <ChoiceChip
                label="Evet, gönder"
                active={form.brifing_enabled === "evet"}
                onClick={() => update("brifing_enabled", "evet")}
              />
              <ChoiceChip
                label="Hayır"
                active={form.brifing_enabled === "hayir"}
                onClick={() => update("brifing_enabled", "hayir")}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Her sabah 9:00&apos;da WhatsApp&apos;a günlük brifing — dünkü satış,
              bugün rezervasyonlar, doğum günü, kritik stok.
            </p>
          </Field>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={status === "saving"}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 rounded-xl disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            {status === "saving" ? "Kaydediliyor…" : "Kaydet ve Demo Yükle"}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Form bitince Sultan Ahmet Kebabevi örnek verisi yüklenir. WhatsApp
            komutlarınızda gerçek bir gün gibi görünür.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ChoiceChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 rounded-xl border text-sm font-medium transition ${
        active
          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
          : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}
