"use client";

/**
 * Ürün detay/düzenleme — alanlar inline düzenlenir, "Kaydet" yapıldığında PUT.
 * Pasif yapma ve silme (soft) yan butonlar.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";

interface CategoryFlat {
  id: string;
  name: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number;
  stockQuantity: number;
  lowStockThreshold: number | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  unit: string;
  barcode: string | null;
  brand: string | null;
  minOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function UrunDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<CategoryFlat[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    category_id: "",
    unit: "adet",
    barcode: "",
    base_price: "",
    stock_quantity: "",
    low_stock_threshold: "",
    min_order: "1",
    brand: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/dagitici/urunler/${id}`, { credentials: "same-origin" }),
        fetch("/api/dagitici/kategoriler", { credentials: "same-origin" }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      if (!pRes.ok || !pData.success) {
        setError(pData.error || "Yüklenemedi.");
        setLoading(false);
        return;
      }
      const p: Product = pData.product;
      setProduct(p);
      setForm({
        code: p.code,
        name: p.name,
        description: p.description || "",
        category_id: p.categoryId || "",
        unit: p.unit,
        barcode: p.barcode || "",
        base_price: String(p.basePrice),
        stock_quantity: String(p.stockQuantity),
        low_stock_threshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : "",
        min_order: String(p.minOrder),
        brand: p.brand || "",
      });
      if (cData.success) setCategories(cData.flat || []);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/dagitici/urunler/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Güncellenemedi.");
        return;
      }
      setSuccess("Kaydedildi.");
      load();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!product) return;
    await fetch(`/api/dagitici/urunler/${id}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !product.isActive }),
    });
    load();
  }

  async function handleDelete() {
    if (!confirm("Bu ürün pasif olacak (soft delete). Emin misin?")) return;
    const res = await fetch(`/api/dagitici/urunler/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      router.push(`/${locale}/dagitici-panel/urunler`);
    }
  }

  function bind<K extends keyof typeof form>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !product) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!product) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/dagitici-panel/urunler`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
          {product.isActive ? (
            <StatusBadge tone="success">Aktif</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Pasif</StatusBadge>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {product.isActive ? (
              <>
                <ToggleRight className="h-4 w-4" /> Pasifleştir
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" /> Aktifleştir
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <Field label="Kod *">
          <input
            type="text"
            {...bind("code")}
            required
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="İsim *">
          <input
            type="text"
            {...bind("name")}
            required
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Kategori">
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
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Barkod">
          <input
            type="text"
            {...bind("barcode")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Marka">
          <input
            type="text"
            {...bind("brand")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Varsayılan Fiyat (₺)">
          <input
            type="number"
            min="0"
            step="0.01"
            {...bind("base_price")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Stok">
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
        <Field label="Min Sipariş">
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
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>

        {error && (
          <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        {success && (
          <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
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
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
