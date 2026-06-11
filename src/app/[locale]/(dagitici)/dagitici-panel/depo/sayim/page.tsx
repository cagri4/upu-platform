"use client";

/**
 * Dağıtıcı — Fiziki sayım listesi + yeni sayım (Faz 5).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Plus } from "lucide-react";
import { DataTable, StatusBadge, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Warehouse { id: string; name: string; isActive: boolean }
interface SessionRow {
  id: string;
  title: string;
  status: string;
  warehouse: string;
  startedAt: string;
  closedAt: string | null;
  diffCount: number;
}

export default function SayimListPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [whId, setWhId] = useState("");
  const [title, setTitle] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dagitici/depo/sayim", { credentials: "same-origin" });
    const d = await res.json();
    if (d.success) setRows(d.items);
  }, []);

  useEffect(() => {
    (async () => {
      const w = await fetch("/api/dagitici/depo", { credentials: "same-origin" }).then((r) => r.json());
      if (w.success) setWarehouses(w.items.filter((x: Warehouse) => x.isActive));
      void load();
    })();
  }, [load]);

  const create = async () => {
    setMsg("");
    if (!whId || !title.trim()) {
      setMsg("Depo ve başlık gerekli.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/depo/sayim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: whId, title: title.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setMsg(d.error || "Oluşturulamadı.");
        return;
      }
      window.location.href = `/${locale}/dagitici-panel/depo/sayim/${d.id}`;
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<SessionRow>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Sayım",
        render: (r) => (
          <Link href={`/${locale}/dagitici-panel/depo/sayim/${r.id}`} className="font-medium text-slate-900 hover:underline">
            {r.title}
          </Link>
        ),
      },
      { key: "wh", header: "Depo", render: (r) => <span className="text-slate-600">{r.warehouse}</span> },
      {
        key: "status",
        header: "Durum",
        render: (r) =>
          r.status === "open" ? <StatusBadge tone="info">Açık</StatusBadge> : <StatusBadge tone="neutral">Kapalı</StatusBadge>,
      },
      {
        key: "diff",
        header: "Fark",
        align: "right",
        render: (r) => (r.diffCount > 0 ? <StatusBadge tone="warning">{r.diffCount} fark</StatusBadge> : <span className="text-slate-400">—</span>),
      },
      { key: "date", header: "Başlangıç", render: (r) => <span className="text-slate-500">{new Date(r.startedAt).toLocaleDateString("tr-TR")}</span> },
    ],
    [locale],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/${locale}/dagitici-panel/depo`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Depolar
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Fiziki Sayım</h1>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Yeni Sayım
        </button>
      </div>

      {showNew && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={whId} onChange={(e) => setWhId(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">Depo seç…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık (Haziran sayımı)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          {msg && <p className="mt-2 text-xs text-rose-600">{msg}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={create} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <ClipboardCheck className="h-4 w-4" /> {saving ? "Açılıyor…" : "Sayımı Başlat"}
            </button>
            <button onClick={() => setShowNew(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} emptyText="Henüz sayım yok." />
    </div>
  );
}
