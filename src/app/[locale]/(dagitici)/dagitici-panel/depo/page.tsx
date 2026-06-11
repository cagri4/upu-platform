"use client";

/**
 * Dağıtıcı — Depo listesi (Faz 5). V3 Modern Dashboard.
 * Multi-depo: liste + KPI + yeni depo + transfer kısayolu.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { Plus, Warehouse, ArrowLeftRight, ClipboardCheck, PackagePlus } from "lucide-react";
import { DataTable, KPICard, StatusBadge, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Row {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  skuCount: number;
  totalQty: number;
}

export default function DepoListPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dagitici/depo", { credentials: "same-origin" });
      const d = await res.json();
      if (d.success) setRows(d.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setErr("Depo adı gerekli.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/dagitici/depo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), address: address.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setErr(d.error || "Oluşturulamadı.");
        return;
      }
      setShowNew(false);
      setName("");
      setAddress("");
      void load();
    } finally {
      setSaving(false);
    }
  };

  const kpi = useMemo(() => {
    const active = rows.filter((r) => r.isActive);
    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    return { count: active.length, totalQty };
  }, [rows]);

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Depo",
        render: (r) => (
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-emerald-600" />
            <Link href={`/${locale}/dagitici-panel/depo/${r.id}`} className="font-medium text-slate-900 hover:underline">
              {r.name}
            </Link>
            {r.isDefault && <StatusBadge tone="info">Varsayılan</StatusBadge>}
            {!r.isActive && <StatusBadge tone="neutral">Pasif</StatusBadge>}
          </div>
        ),
      },
      { key: "address", header: "Adres", render: (r) => <span className="text-slate-500">{r.address || "—"}</span> },
      { key: "sku", header: "Ürün Çeşidi", align: "right", sortable: true, sortValue: (r) => r.skuCount, render: (r) => r.skuCount },
      {
        key: "qty",
        header: "Toplam Adet",
        align: "right",
        sortable: true,
        sortValue: (r) => r.totalQty,
        render: (r) => <span className="tabular-nums font-medium">{r.totalQty.toLocaleString("tr-TR")}</span>,
      },
    ],
    [locale],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Depo Yönetimi</h1>
          <p className="text-sm text-slate-500">Çoklu depo, stok, transfer, sayım ve mal kabul.</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Yeni Depo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard label="Aktif Depo" value={String(kpi.count)} />
        <KPICard label="Toplam Stok" value={kpi.totalQty.toLocaleString("tr-TR")} hint="tüm depolar" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/dagitici-panel/depo/transfer`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ArrowLeftRight className="h-4 w-4" /> Transfer
        </Link>
        <Link href={`/${locale}/dagitici-panel/depo/sayim`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ClipboardCheck className="h-4 w-4" /> Sayım
        </Link>
        <Link href={`/${locale}/dagitici-panel/depo/mal-kabul`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <PackagePlus className="h-4 w-4" /> Mal Kabul
        </Link>
      </div>

      {showNew && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Yeni Depo</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Depo adı (Ana Depo)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adres (opsiyonel)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={create} disabled={saving} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button onClick={() => setShowNew(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} emptyText="Henüz depo yok. 'Yeni Depo' ile başla." />
      )}
    </div>
  );
}
