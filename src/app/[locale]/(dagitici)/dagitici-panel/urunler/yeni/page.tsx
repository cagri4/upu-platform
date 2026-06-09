"use client";

/**
 * Yeni ürün — sade form (kod, isim, kategori, birim, varsayılan fiyat, stok).
 * Daha ayrıntılı düzenleme detay sayfasında yapılır.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface CategoryFlat {
  id: string;
  name: string;
}

export default function YeniUrunPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [categories, setCategories] = useState<CategoryFlat[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    category_id: "",
    unit: "adet",
    barcode: "",
    base_price: "",
    stock_quantity: "0",
    low_stock_threshold: "10",
    min_order: "1",
    brand: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dagitici/kategoriler", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.flat || []);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.code.trim() || !form.name.trim()) {
      setError("Kod ve isim zorunlu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/urunler", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
        setSaving(false);
        return;
      }
      router.push(`/${locale}/dagitici-panel/urunler/${d.id}`);
    } catch {
      setError("Bağlantı hatası.");
      setSaving(false);
    }
  }

  function bind<K extends keyof typeof form>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/dagitici-panel/urunler`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Yeni Ürün</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <Field label="Ürün Kodu *">
          <input
            type="text"
            {...bind("code")}
            placeholder="SP-500"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            required
          />
        </Field>
        <Field label="Ürün Adı *">
          <input
            type="text"
            {...bind("name")}
            placeholder="Spagetti 500g"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            required
          />
        </Field>
        <Field label="Kategori" hint="Sonradan ekleyebilirsin">
          <select
            {...bind("category_id")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">— Seç —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Birim">
          <input
            type="text"
            {...bind("unit")}
            placeholder="adet / koli / kg"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Barkod">
          <input
            type="text"
            {...bind("barcode")}
            placeholder="869..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Marka">
          <input
            type="text"
            {...bind("brand")}
            placeholder="—"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Varsayılan Fiyat (₺)">
          <input
            type="number"
            min="0"
            step="0.01"
            {...bind("base_price")}
            placeholder="25.00"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Açılış Stok">
          <input
            type="number"
            min="0"
            step="1"
            {...bind("stock_quantity")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Düşük Stok Eşiği">
          <input
            type="number"
            min="0"
            step="1"
            {...bind("low_stock_threshold")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Min Sipariş Miktarı">
          <input
            type="number"
            min="1"
            step="1"
            {...bind("min_order")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Açıklama" full>
          <textarea
            {...bind("description")}
            rows={3}
            placeholder="—"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>

        {error && (
          <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/dagitici-panel/urunler`)}
            className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  full,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
