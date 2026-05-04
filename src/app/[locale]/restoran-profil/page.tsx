"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    // Init: token doğrula + varsa mevcut form değerlerini al
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
          setForm(f => ({
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
    setForm(f => ({ ...f, [key]: value }));
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
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Yükleniyor…</div>;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Bir sorun var</h1>
          <p className="text-gray-600">{error || "Beklenmedik hata."}</p>
        </div>
      </div>
    );
  }

  if (status === "done") {
    const waUrl = `https://wa.me/${BOT_WA_NUMBER}?text=brifing`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Hoş geldiniz!</h1>
          <p className="text-gray-600 mb-6">
            Profiliniz kaydedildi. Örnek restoran (<b>Sultan Ahmet Kebabevi</b>) verisini yükledim — 8 masa, 30 menü kalemi, 8 müdavim, bugün 4 rezervasyon.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            WhatsApp&apos;a dönün ve şu komutları sırayla deneyin:<br />
            <code className="text-orange-600">brifing</code>{" · "}
            <code className="text-orange-600">rezervasyon</code>{" · "}
            <code className="text-orange-600">sadakat</code>{" · "}
            <code className="text-orange-600">menukalemleri</code>
          </p>
          <a
            href={waUrl}
            className="inline-block bg-green-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-green-700 transition"
          >
            💬 WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Restoran Profili</h1>
          <p className="text-sm text-gray-500 mt-1">Sizi tanıyalım — 2-3 dakika sürer.</p>
        </div>

        <div className="space-y-5">
          <Field label="Ad soyad *">
            <input
              type="text"
              value={form.display_name}
              onChange={e => update("display_name", e.target.value)}
              placeholder="Mehmet Yılmaz"
              className={inputCls}
            />
          </Field>

          <Field label="Restoran/cafe adı *">
            <input
              type="text"
              value={form.restaurant_name}
              onChange={e => update("restaurant_name", e.target.value)}
              placeholder="Anadolu Sofrası"
              className={inputCls}
            />
          </Field>

          <Field label="Şehir / bölge *">
            <input
              type="text"
              value={form.location}
              onChange={e => update("location", e.target.value)}
              placeholder="Rotterdam Centrum"
              className={inputCls}
            />
          </Field>

          <Field label="İşletme tipi *">
            <select
              value={form.segment}
              onChange={e => update("segment", e.target.value as Form["segment"])}
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
              onChange={e => update("capacity", e.target.value as Form["capacity"])}
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
              onChange={e => update("accounting", e.target.value as Form["accounting"])}
              className={inputCls}
            >
              <option value="">Şimdilik boş bırak</option>
              {Object.entries(ACCOUNTING_LABELS).filter(([k]) => k !== "").map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Sabah brifingi">
            <div className="flex gap-3">
              <BriefingChip
                label="Evet, gönder"
                active={form.brifing_enabled === "evet"}
                onClick={() => update("brifing_enabled", "evet")}
              />
              <BriefingChip
                label="Hayır"
                active={form.brifing_enabled === "hayir"}
                onClick={() => update("brifing_enabled", "hayir")}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Her sabah 9:00&apos;da WhatsApp&apos;a günlük brifing — dünkü satış, bugün rezervasyonlar, doğum günü, kritik stok.
            </p>
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={status === "saving"}
            className="w-full bg-orange-600 text-white font-medium py-3 rounded-xl hover:bg-orange-700 disabled:bg-gray-300 transition"
          >
            {status === "saving" ? "Kaydediliyor…" : "Kaydet ve Demo Yükle"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Form bitince Sultan Ahmet Kebabevi örnek verisi yüklenir. WhatsApp komutlarınızda gerçek bir gün gibi görünür.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function BriefingChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition ${
        active
          ? "bg-orange-600 text-white border-orange-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
