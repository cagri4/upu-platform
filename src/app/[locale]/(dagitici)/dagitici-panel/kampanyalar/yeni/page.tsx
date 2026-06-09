"use client";

/**
 * Yeni kampanya — Adım 1: tipini büyük kart olarak seç + temel bilgileri gir.
 * Hedefleme + kural detayı detay sayfasında.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Percent,
  Boxes,
  Ticket,
  Gift,
  Truck,
} from "lucide-react";

const TYPES = [
  {
    id: "percent_discount",
    label: "% İndirim",
    desc: "Belirli ürün veya kategoriye yüzde indirim",
    icon: Percent,
  },
  {
    id: "volume_discount",
    label: "Al-X-öde-Y",
    desc: "30 koli al, 5 koli bedava",
    icon: Boxes,
  },
  {
    id: "coupon",
    label: "Kupon Kodu",
    desc: "Bayi siparişte kod girerse ek indirim",
    icon: Ticket,
  },
  {
    id: "gift_product",
    label: "Hediye Ürün",
    desc: "Belirli tutarın üstünde hediye ürün",
    icon: Gift,
  },
  {
    id: "free_shipping",
    label: "Ücretsiz Kargo",
    desc: "Min tutar üstü siparişlere kargo bedava",
    icon: Truck,
  },
] as const;

type TypeId = (typeof TYPES)[number]["id"];

export default function YeniKampanyaPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "percent_discount" as TypeId,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    coupon_code: "",
    max_usage: "",
    per_dealer_max_usage: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Kampanya adı zorunlu.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("Başlangıç + bitiş tarihi zorunlu.");
      return;
    }
    if (form.type === "coupon" && !form.coupon_code.trim()) {
      setError("Kupon tipinde kod zorunlu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/kampanyalar", {
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
      router.push(`/${locale}/dagitici-panel/kampanyalar/${d.id}`);
    } catch {
      setError("Bağlantı hatası.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/dagitici-panel/kampanyalar`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Yeni Kampanya</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium text-slate-700">1) Kampanya Tipi</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const selected = form.type === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${selected ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  <span className={`text-sm font-medium ${selected ? "text-emerald-900" : "text-slate-900"}`}>
                    {t.label}
                  </span>
                  <span className="text-xs text-slate-500">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">2) Temel Bilgi</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Kampanya Adı *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ramazan Kampanyası 2026"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Açıklama</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                placeholder="Kısa not — bayi bu metni görmeyecek."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Başlangıç *</span>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Bitiş *</span>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </label>
            {form.type === "coupon" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700">Kupon Kodu *</span>
                <input
                  type="text"
                  value={form.coupon_code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, coupon_code: e.target.value.toUpperCase() }))
                  }
                  placeholder="RAMAZAN25"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase focus:border-emerald-500 focus:outline-none"
                  required
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">
                Max Kullanım (toplam)
              </span>
              <input
                type="number"
                min={0}
                value={form.max_usage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_usage: e.target.value }))
                }
                placeholder="Sınırsız"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">
                Bayi Başına Max Kullanım
              </span>
              <input
                type="number"
                min={0}
                value={form.per_dealer_max_usage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, per_dealer_max_usage: e.target.value }))
                }
                placeholder="Sınırsız"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <p className="text-xs text-slate-500">
            Sonraki adımda: hedefleme (segment / bölge / bayi) + kural (indirim
            yüzdesi vb.)
          </p>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Oluşturuluyor…" : "Oluştur ve Detaya Geç"}
          </button>
        </div>
      </form>
    </div>
  );
}
