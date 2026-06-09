"use client";

/**
 * Fiyat liste detay — ürün × fiyat tablosu + kademe iskonto editor.
 *
 * - Üstte başlık (isim, geçerlilik, durum) düzenlenebilir
 * - "Ürün Ekle" — modal: ürün seç + fiyat gir → upsert
 * - Her item satırı:
 *     · unit_price (inline edit)
 *     · "Kademe" butonuyla expand → min_quantity → discount_percent tablosu
 *
 * resolveDealerPrice() motorunda tier'lar otomatik uygulanır.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";

interface Tier {
  id?: string;
  minQuantity: number;
  discountPercent: number;
}

interface Item {
  id: string;
  productId: string;
  productCode: string | null;
  productName: string | null;
  productUnit: string;
  productBasePrice: number | null;
  productActive: boolean | null;
  unitPrice: number;
  currency: string;
  notes: string | null;
  tiers: Tier[];
}

interface ListData {
  id: string;
  name: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  currency: string;
  items: Item[];
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  basePrice: number;
  unit: string;
}

const formatPara = (n: number, c: string = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(n);

export default function FiyatListeDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerForm, setHeaderForm] = useState({
    name: "",
    description: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
  });
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSuccess, setHeaderSuccess] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [addForm, setAddForm] = useState({ product_id: "", unit_price: "" });
  const [adding, setAdding] = useState(false);

  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dagitici/fiyat-listeleri/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      const l: ListData = d.list;
      setList(l);
      setHeaderForm({
        name: l.name,
        description: l.description || "",
        valid_from: l.validFrom || "",
        valid_until: l.validUntil || "",
        is_active: l.isActive,
      });
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function loadProductOptions() {
    const res = await fetch("/api/dagitici/urunler?status=active&pageSize=200", {
      credentials: "same-origin",
    });
    const d = await res.json();
    if (d.success) {
      const taken = new Set((list?.items ?? []).map((i) => i.productId));
      setProductOptions(
        (d.items ?? [])
          .filter((p: { id: string }) => !taken.has(p.id))
          .map((p: { id: string; code: string; name: string; basePrice: number; unit: string }) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            basePrice: p.basePrice,
            unit: p.unit,
          })),
      );
    }
  }

  async function handleSaveHeader() {
    setSavingHeader(true);
    setHeaderSuccess("");
    try {
      const res = await fetch(`/api/dagitici/fiyat-listeleri/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(headerForm),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
      } else {
        setHeaderSuccess("Başlık kaydedildi.");
        load();
      }
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleAddItem() {
    if (!addForm.product_id || !addForm.unit_price) {
      alert("Ürün ve fiyat gerekli.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/dagitici/fiyat-listeleri/${id}/items`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: addForm.product_id,
          unit_price: Number(addForm.unit_price),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Eklenemedi.");
        return;
      }
      setShowAddModal(false);
      setAddForm({ product_id: "", unit_price: "" });
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateItem(item: Item, patch: Partial<{ unit_price: number; tiers: Tier[] }>) {
    const body: Record<string, unknown> = {};
    if (patch.unit_price != null) body.unit_price = patch.unit_price;
    if (patch.tiers) {
      body.tiers = patch.tiers.map((t) => ({
        min_quantity: t.minQuantity,
        discount_percent: t.discountPercent,
      }));
    }
    const res = await fetch(
      `/api/dagitici/fiyat-listeleri/${id}/items/${item.id}`,
      {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Güncellenemedi.");
    }
    load();
  }

  async function handleDeleteItem(item: Item) {
    if (!confirm(`${item.productName} listeden çıkarılsın mı?`)) return;
    await fetch(`/api/dagitici/fiyat-listeleri/${id}/items/${item.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    load();
  }

  async function handleDeleteList() {
    if (!confirm("Bu fiyat listesi silinsin mi? İçerik ve bayi atamaları da kalkar.")) return;
    const res = await fetch(`/api/dagitici/fiyat-listeleri/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) router.push(`/${locale}/dagitici-panel/fiyat-listeleri`);
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !list) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!list) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/dagitici-panel/fiyat-listeleri`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{list.name}</h1>
          {list.isActive ? (
            <StatusBadge tone="success">Aktif</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Pasif</StatusBadge>
          )}
        </div>
        <button
          onClick={handleDeleteList}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-700 hover:bg-rose-100"
        >
          <Trash2 className="h-4 w-4" />
          Listeyi Sil
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Başlık</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">İsim</span>
            <input
              type="text"
              value={headerForm.name}
              onChange={(e) => setHeaderForm((f) => ({ ...f, name: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Açıklama</span>
            <textarea
              value={headerForm.description}
              onChange={(e) =>
                setHeaderForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Başlangıç</span>
            <input
              type="date"
              value={headerForm.valid_from}
              onChange={(e) =>
                setHeaderForm((f) => ({ ...f, valid_from: e.target.value }))
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Bitiş</span>
            <input
              type="date"
              value={headerForm.valid_until}
              onChange={(e) =>
                setHeaderForm((f) => ({ ...f, valid_until: e.target.value }))
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={headerForm.is_active}
              onChange={(e) =>
                setHeaderForm((f) => ({ ...f, is_active: e.target.checked }))
              }
              className="accent-emerald-600"
            />
            Aktif
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveHeader}
              disabled={savingHeader}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingHeader ? "Kaydediliyor…" : "Başlığı Kaydet"}
            </button>
            {headerSuccess && (
              <span className="text-sm text-emerald-700">{headerSuccess}</span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Ürün × Fiyat ({list.items.length})
            </h2>
            <p className="text-xs text-slate-500">
              Kademe iskontolar her satırın yanındaki "Kademe" butonu ile.
            </p>
          </div>
          <button
            onClick={() => {
              loadProductOptions();
              setShowAddModal(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Ürün Ekle
          </button>
        </div>

        {list.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Henüz ürün eklenmedi. "Ürün Ekle" ile başla.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                currency={list.currency}
                expanded={expandedItem === item.id}
                onToggle={() =>
                  setExpandedItem((p) => (p === item.id ? null : item.id))
                }
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </section>

      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Listeye Ürün Ekle
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700">Ürün</span>
                <select
                  value={addForm.product_id}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, product_id: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">— Seç —</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} (varsayılan {formatPara(p.basePrice)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700">
                  Bu liste için birim fiyat (₺)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.unit_price}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, unit_price: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={adding}
                  className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {adding ? "Ekleniyor…" : "Ekle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  currency,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  item: Item;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (item: Item, patch: Partial<{ unit_price: number; tiers: Tier[] }>) => Promise<void>;
  onDelete: (item: Item) => void;
}) {
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [tiers, setTiers] = useState<Tier[]>(item.tiers);

  useEffect(() => {
    setUnitPrice(String(item.unitPrice));
    setTiers(item.tiers);
  }, [item.unitPrice, item.tiers]);

  const dirty =
    Number(unitPrice) !== item.unitPrice ||
    tiers.length !== item.tiers.length ||
    tiers.some(
      (t, i) =>
        t.minQuantity !== item.tiers[i]?.minQuantity ||
        t.discountPercent !== item.tiers[i]?.discountPercent,
    );

  const previewPrice = (qty: number): number => {
    const applicable = [...tiers]
      .filter((t) => t.minQuantity <= qty)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    const disc = applicable[0]?.discountPercent ?? 0;
    return +(Number(unitPrice) * (1 - disc / 100)).toFixed(2);
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-slate-500 hover:text-slate-700"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-medium text-slate-900">
            {item.productName || "—"}
          </p>
          <p className="text-xs text-slate-500">
            {item.productCode || "—"} · varsayılan{" "}
            {formatPara(item.productBasePrice ?? 0, currency)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Liste fiyatı:</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums focus:border-emerald-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">{currency}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() =>
              onUpdate(item, { unit_price: Number(unitPrice), tiers })
            }
            disabled={!dirty}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Kaydet
          </button>
          <button
            onClick={() => onDelete(item)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              Kademe İskontoları
            </p>
            <button
              type="button"
              onClick={() =>
                setTiers((arr) => [
                  ...arr,
                  { minQuantity: (arr[arr.length - 1]?.minQuantity ?? 0) + 10, discountPercent: 5 },
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              Kademe ekle
            </button>
          </div>
          {tiers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Kademe iskontosu yok — her miktar liste fiyatından satılır.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {tiers.map((t, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs"
                >
                  <label className="flex items-center gap-1.5">
                    <span className="w-16 text-slate-500">Min miktar</span>
                    <input
                      type="number"
                      min={1}
                      value={t.minQuantity}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setTiers((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, minQuantity: v } : x)),
                        );
                      }}
                      className="h-7 w-20 rounded-md border border-slate-200 bg-white px-1.5 text-xs tabular-nums focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="w-16 text-slate-500">İskonto %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={t.discountPercent}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setTiers((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, discountPercent: v } : x)),
                        );
                      }}
                      className="h-7 w-20 rounded-md border border-slate-200 bg-white px-1.5 text-xs tabular-nums focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setTiers((arr) => arr.filter((_, i) => i !== idx))}
                    className="rounded-md p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tiers.length > 0 && (
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Önizleme:</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                <span>1 adet → {formatPara(previewPrice(1), currency)}</span>
                <span>10 adet → {formatPara(previewPrice(10), currency)}</span>
                <span>50 adet → {formatPara(previewPrice(50), currency)}</span>
                <span>100 adet → {formatPara(previewPrice(100), currency)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
