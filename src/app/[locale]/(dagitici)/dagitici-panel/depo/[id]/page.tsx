"use client";

/**
 * Dağıtıcı — Depo detay (Faz 5). Stok satırları (ürün × adet + min/max durum).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DataTable, StatusBadge, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface StockRow {
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  min: number | null;
  max: number | null;
  belowMin: boolean;
  aboveMax: boolean;
}

export default function DepoDetailPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [name, setName] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dagitici/depo/${id}`, { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setName(d.warehouse.name);
      setRows(d.stock);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<StockRow>[] = useMemo(
    () => [
      { key: "code", header: "Kod", render: (r) => <span className="tabular-nums text-slate-500">{r.code}</span> },
      { key: "name", header: "Ürün", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
      {
        key: "qty",
        header: "Adet",
        align: "right",
        sortable: true,
        sortValue: (r) => r.quantity,
        render: (r) => <span className="tabular-nums font-medium">{r.quantity.toLocaleString("tr-TR")} {r.unit}</span>,
      },
      {
        key: "durum",
        header: "Durum",
        render: (r) =>
          r.belowMin ? (
            <StatusBadge tone="danger">Kritik (min {r.min})</StatusBadge>
          ) : r.aboveMax ? (
            <StatusBadge tone="warning">Fazla (max {r.max})</StatusBadge>
          ) : (
            <StatusBadge tone="success">Normal</StatusBadge>
          ),
      },
    ],
    [],
  );

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/${locale}/dagitici-panel/depo`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Depolar
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/depo`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Depolar
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{name || "Depo"}</h1>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.productId} emptyText="Bu depoda stok yok. Mal kabul ile giriş yap." />
      )}
    </div>
  );
}
