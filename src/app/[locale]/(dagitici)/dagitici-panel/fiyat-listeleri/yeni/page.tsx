"use client";

/**
 * Yeni fiyat listesi başlığı.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function YeniFiyatListePage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [form, setForm] = useState({
    name: "",
    description: "",
    valid_from: "",
    valid_until: "",
    currency: "TRY",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("İsim zorunlu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/fiyat-listeleri", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Oluşturulamadı.");
        setSaving(false);
        return;
      }
      router.push(`/${locale}/dagitici-panel/fiyat-listeleri/${d.id}`);
    } catch {
      setError("Bağlantı hatası.");
      setSaving(false);
    }
  }

  function bind<K extends keyof typeof form>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/dagitici-panel/fiyat-listeleri`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Yeni Fiyat Listesi</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Liste Adı *</span>
          <input
            type="text"
            {...bind("name")}
            required
            placeholder="A-segment Fiyat / Ramazan Kampanyası / Default"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Açıklama</span>
          <textarea
            {...bind("description")}
            rows={2}
            placeholder="Bu listeye notunuzu girin."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Geçerli — Başlangıç</span>
          <input
            type="date"
            {...bind("valid_from")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Geçerli — Bitiş</span>
          <input
            type="date"
            {...bind("valid_until")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Para Birimi</span>
          <select
            {...bind("currency")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="TRY">₺ TRY</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
        </label>

        {error && (
          <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/dagitici-panel/fiyat-listeleri`)}
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Oluşturuluyor…" : "Oluştur ve İçerik Ekle"}
          </button>
        </div>
      </form>
    </div>
  );
}
