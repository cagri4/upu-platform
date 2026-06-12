"use client";

/**
 * Dağıtıcı — Saha Satış (Faz 6). V3 Modern Dashboard.
 * Saha elemanı listesi + KPI + performans + yeni eleman (atanmış bayiler).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Plus, MapPin, Users, ClipboardCheck } from "lucide-react";
import { DataTable, KPICard, StatusBadge, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Rep {
  id: string;
  name: string;
  phone: string;
  region: string | null;
  hasLogin: boolean;
  isActive: boolean;
  dealerCount: number;
  visitCount: number;
  lastVisitAt: string | null;
}
interface DealerOpt {
  id: string;
  name: string;
}
interface PerfRow {
  id: string;
  name: string;
  region: string | null;
  visits: number;
  completedVisits: number;
  orders: number;
  orderRatio: number;
  lastActivityAt: string | null;
}

export default function SahaListPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.saha")) notFound();

  const [reps, setReps] = useState<Rep[]>([]);
  const [perf, setPerf] = useState<PerfRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState("");
  const [dealers, setDealers] = useState<DealerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        fetch("/api/dagitici/saha", { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/bayiler?pageSize=200", { credentials: "same-origin" }).then((x) => x.json()),
      ]);
      if (r.success) setReps(r.items);
      if (d.items) setDealers(d.items.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPerf = useCallback(async () => {
    const url = regionFilter ? `/api/dagitici/saha/dashboard?region=${encodeURIComponent(regionFilter)}` : "/api/dagitici/saha/dashboard";
    const d = await fetch(url, { credentials: "same-origin" }).then((x) => x.json());
    if (d.success) {
      setPerf(d.rows);
      setRegions(d.regions);
    }
  }, [regionFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadPerf(); }, [loadPerf]);

  const create = async () => {
    if (!name.trim() || !phone.trim()) {
      setErr("Ad ve telefon gerekli.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/dagitici/saha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          region: region.trim() || undefined,
          dealer_ids: Array.from(picked),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setErr(d.error || "Oluşturulamadı.");
        return;
      }
      setShowNew(false);
      setName(""); setPhone(""); setRegion(""); setPicked(new Set());
      void load(); void loadPerf();
    } finally {
      setSaving(false);
    }
  };

  const kpi = useMemo(() => {
    const active = reps.filter((r) => r.isActive).length;
    const visits = perf.reduce((s, r) => s + r.visits, 0);
    const orders = perf.reduce((s, r) => s + r.orders, 0);
    return { active, visits, orders };
  }, [reps, perf]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const repCols: DataTableColumn<Rep>[] = useMemo(() => [
    {
      key: "name", header: "Eleman",
      render: (r) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <Link href={`/${locale}/dagitici-panel/saha/${r.id}`} className="font-medium text-slate-900 hover:underline">{r.name}</Link>
          {!r.isActive && <StatusBadge tone="neutral">Pasif</StatusBadge>}
          {!r.hasLogin && <StatusBadge tone="warning">Giriş yok</StatusBadge>}
        </div>
      ),
    },
    { key: "region", header: "Bölge", render: (r) => <span className="text-slate-500">{r.region || "—"}</span> },
    { key: "phone", header: "Telefon", render: (r) => <span className="text-slate-500 tabular-nums">{r.phone}</span> },
    { key: "dealers", header: "Bayi", align: "right", sortable: true, sortValue: (r) => r.dealerCount, render: (r) => r.dealerCount },
    { key: "visits", header: "Ziyaret", align: "right", sortable: true, sortValue: (r) => r.visitCount, render: (r) => <span className="tabular-nums font-medium">{r.visitCount}</span> },
  ], [locale]);

  const perfCols: DataTableColumn<PerfRow>[] = useMemo(() => [
    { key: "name", header: "Eleman", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: "region", header: "Bölge", render: (r) => <span className="text-slate-500">{r.region || "—"}</span> },
    { key: "visits", header: "Ziyaret", align: "right", sortable: true, sortValue: (r) => r.visits, render: (r) => <span className="tabular-nums">{r.visits}</span> },
    { key: "done", header: "Tamamlanan", align: "right", render: (r) => <span className="tabular-nums">{r.completedVisits}</span> },
    { key: "orders", header: "Sipariş", align: "right", sortable: true, sortValue: (r) => r.orders, render: (r) => <span className="tabular-nums">{r.orders}</span> },
    { key: "ratio", header: "Sipariş/Ziyaret", align: "right", render: (r) => <span className="tabular-nums font-medium">{r.orderRatio.toLocaleString("tr-TR")}</span> },
    { key: "last", header: "Son Aktivite", render: (r) => <span className="text-slate-500">{r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString("tr-TR") : "—"}</span> },
  ], []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saha Satış</h1>
          <p className="text-sm text-slate-500">Saha elemanları, ziyaret planı ve performans.</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Yeni Eleman
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard label="Aktif Eleman" value={String(kpi.active)} />
        <KPICard label="Ziyaret (30g)" value={String(kpi.visits)} />
        <KPICard label="Sipariş (30g)" value={String(kpi.orders)} hint="ziyaretten" />
      </div>

      {showNew && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Yeni Saha Elemanı</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (+90...)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Bölge (opsiyonel)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Atanmış Bayiler ({picked.size})</p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-100 p-2">
              {dealers.map((d) => (
                <button key={d.id} onClick={() => togglePick(d.id)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${picked.has(d.id) ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
              ))}
              {dealers.length === 0 && <span className="text-xs text-slate-400">Önce bayi ekle.</span>}
            </div>
          </div>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={create} disabled={saving} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Kaydediliyor…" : "Kaydet"}</button>
            <button onClick={() => setShowNew(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : (
        <>
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Elemanlar</h2>
            </div>
            <DataTable rows={reps} columns={repCols} rowKey={(r) => r.id} emptyText="Henüz saha elemanı yok. 'Yeni Eleman' ile başla." />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">Performans (son 30 gün)</h2>
              </div>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
                <option value="">Tüm bölgeler</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <DataTable rows={perf} columns={perfCols} rowKey={(r) => r.id} emptyText="Bu dönem aktivite yok." />
          </section>
        </>
      )}
    </div>
  );
}
