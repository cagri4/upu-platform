"use client";

/**
 * Dağıtıcı — Satın Alma (Faz 7). V3 Modern Dashboard.
 * Tedarikçiler + PO'lar + cari + gecikmiş PO uyarısı + yeni tedarikçi/PO.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Plus, Truck, FileText, AlertTriangle, Trash2 } from "lucide-react";
import { DataTable, KPICard, StatusBadge, type DataTableColumn } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Supplier { id: string; name: string; balance: number; debt: number; paid: number; paymentTermDays: number }
interface PO { id: string; poNumber: string; supplierName: string; status: string; expectedDate: string | null; total: number; overdue: boolean }
interface Prod { id: string; name: string; basePrice: number }
interface Line { productId: string; name: string; quantity: number; unitPrice: number }

const STATUS_LABEL: Record<string, string> = { draft: "Taslak", sent: "Gönderildi", partial: "Kısmi Kabul", received: "Tamamen Kabul", closed: "Kapandı" };
const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = { draft: "neutral", sent: "info", partial: "warning", received: "success", closed: "neutral" };

export default function SatinAlmaPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.satinalma")) notFound();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [overdue, setOverdue] = useState<PO[]>([]);
  const [totals, setTotals] = useState({ activePOs: 0, overduePOs: 0, openBalance: 0 });
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);

  // new supplier
  const [showSup, setShowSup] = useState(false);
  const [supName, setSupName] = useState("");
  const [supTax, setSupTax] = useState("");
  const [supTerm, setSupTerm] = useState("");
  const [supErr, setSupErr] = useState("");

  // new PO
  const [showPO, setShowPO] = useState(false);
  const [poSupplier, setPoSupplier] = useState("");
  const [poDate, setPoDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [poErr, setPoErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, dash, pr] = await Promise.all([
        fetch("/api/dagitici/satinalma/tedarikci", { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/satinalma", { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/satinalma/dashboard", { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/urunler?pageSize=200", { credentials: "same-origin" }).then((x) => x.json()),
      ]);
      if (s.success) setSuppliers(s.items);
      if (p.success) setPos(p.items);
      if (dash.success) { setOverdue(dash.overduePOs); setTotals(dash.totals); }
      if (pr.items) setProds(pr.items.map((x: { id: string; name: string; basePrice: number }) => ({ id: x.id, name: x.name, basePrice: x.basePrice })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createSupplier = async () => {
    if (!supName.trim()) { setSupErr("Ad gerekli."); return; }
    const res = await fetch("/api/dagitici/satinalma/tedarikci", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: supName.trim(), tax_no: supTax.trim() || undefined, payment_term_days: supTerm || undefined }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) { setSupErr(d.error || "Oluşturulamadı."); return; }
    setShowSup(false); setSupName(""); setSupTax(""); setSupTerm(""); setSupErr("");
    void load();
  };

  const addLine = () => setLines((l) => [...l, { productId: "", name: "", quantity: 1, unitPrice: 0 }]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const rmLine = (i: number) => setLines((l) => l.filter((_, j) => j !== i));
  const onPickProduct = (i: number, pid: string) => {
    const p = prods.find((x) => x.id === pid);
    setLine(i, { productId: pid, name: p?.name || "", unitPrice: p?.basePrice ?? 0 });
  };
  const poTotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines]);

  const createPO = async () => {
    if (!poSupplier) { setPoErr("Tedarikçi seç."); return; }
    const valid = lines.filter((l) => l.productId && l.quantity > 0);
    if (valid.length === 0) { setPoErr("En az bir ürün satırı ekle."); return; }
    const res = await fetch("/api/dagitici/satinalma", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: poSupplier, expected_date: poDate || undefined, lines: valid.map((l) => ({ product_id: l.productId, quantity: l.quantity, unit_price: l.unitPrice })) }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) { setPoErr(d.error || "Oluşturulamadı."); return; }
    setShowPO(false); setPoSupplier(""); setPoDate(""); setLines([]); setPoErr("");
    void load();
  };

  const supCols: DataTableColumn<Supplier>[] = useMemo(() => [
    { key: "name", header: "Tedarikçi", render: (s) => (
      <Link href={`/${locale}/dagitici-panel/satinalma/tedarikci/${s.id}`} className="font-medium text-slate-900 hover:underline">{s.name}</Link>
    ) },
    { key: "term", header: "Vade", align: "right", render: (s) => <span className="text-slate-500">{s.paymentTermDays} gün</span> },
    { key: "debt", header: "Borç", align: "right", render: (s) => <span className="tabular-nums">{s.debt.toLocaleString("tr-TR")} ₺</span> },
    { key: "paid", header: "Ödenen", align: "right", render: (s) => <span className="tabular-nums text-emerald-600">{s.paid.toLocaleString("tr-TR")} ₺</span> },
    { key: "bal", header: "Kalan", align: "right", sortable: true, sortValue: (s) => s.balance, render: (s) => <span className={`tabular-nums font-medium ${s.balance > 0 ? "text-rose-600" : "text-slate-900"}`}>{s.balance.toLocaleString("tr-TR")} ₺</span> },
  ], [locale]);

  const poCols: DataTableColumn<PO>[] = useMemo(() => [
    { key: "no", header: "PO", render: (p) => (
      <div className="flex items-center gap-2">
        <Link href={`/${locale}/dagitici-panel/satinalma/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.poNumber}</Link>
        {p.overdue && <StatusBadge tone="warning">Gecikmiş</StatusBadge>}
      </div>
    ) },
    { key: "sup", header: "Tedarikçi", render: (p) => <span className="text-slate-600">{p.supplierName}</span> },
    { key: "status", header: "Durum", render: (p) => <StatusBadge tone={STATUS_TONE[p.status] || "neutral"}>{STATUS_LABEL[p.status] || p.status}</StatusBadge> },
    { key: "exp", header: "Teslim", render: (p) => <span className="text-slate-500">{p.expectedDate || "—"}</span> },
    { key: "total", header: "Tutar", align: "right", sortable: true, sortValue: (p) => p.total, render: (p) => <span className="tabular-nums font-medium">{p.total.toLocaleString("tr-TR")} ₺</span> },
  ], [locale]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Satın Alma</h1>
          <p className="text-sm text-slate-500">Tedarikçiler, satın alma siparişleri ve cari.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowSup((v) => !v); setShowPO(false); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Truck className="h-4 w-4" /> Tedarikçi</button>
          <button onClick={() => { setShowPO((v) => !v); setShowSup(false); if (lines.length === 0) addLine(); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Yeni PO</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPICard label="Aktif PO" value={String(totals.activePOs)} />
        <KPICard label="Gecikmiş PO" value={String(totals.overduePOs)} />
        <KPICard label="Açık Bakiye" value={`${totals.openBalance.toLocaleString("tr-TR")} ₺`} hint="tedarikçilere" />
      </div>

      {overdue.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Gecikmiş Siparişler ({overdue.length})</div>
          <ul className="mt-2 flex flex-col gap-1">
            {overdue.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <Link href={`/${locale}/dagitici-panel/satinalma/${p.id}`} className="text-amber-900 hover:underline">{p.poNumber} · {p.supplierName}</Link>
                <span className="text-amber-700">teslim {p.expectedDate}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSup && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Yeni Tedarikçi</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="Tedarikçi adı" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={supTax} onChange={(e) => setSupTax(e.target.value)} placeholder="Vergi no (opsiyonel)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input value={supTerm} onChange={(e) => setSupTerm(e.target.value)} placeholder="Ödeme vadesi (gün)" type="number" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          {supErr && <p className="mt-2 text-xs text-rose-600">{supErr}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={createSupplier} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Kaydet</button>
            <button onClick={() => setShowSup(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {showPO && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Yeni Satın Alma Siparişi</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="">Tedarikçi seç…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={poDate} onChange={(e) => setPoDate(e.target.value)} type="date" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_90px_32px] items-center gap-2">
                <select value={l.productId} onChange={(e) => onPickProduct(i, e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
                  <option value="">Ürün…</option>
                  {prods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Math.floor(Number(e.target.value))) })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm tabular-nums" placeholder="Adet" />
                <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Math.max(0, Number(e.target.value)) })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm tabular-nums" placeholder="Fiyat" />
                <button onClick={() => rmLine(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={addLine} className="inline-flex h-8 w-fit items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Satır ekle</button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Toplam: {poTotal.toLocaleString("tr-TR")} ₺</span>
            {poErr && <span className="text-xs text-rose-600">{poErr}</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={createPO} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">PO Oluştur (taslak)</button>
            <button onClick={() => setShowPO(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>
      ) : (
        <>
          <section>
            <div className="mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /><h2 className="text-sm font-semibold text-slate-900">Satın Alma Siparişleri</h2></div>
            <DataTable rows={pos} columns={poCols} rowKey={(p) => p.id} emptyText="Henüz PO yok. 'Yeni PO' ile başla." />
          </section>
          <section>
            <div className="mb-2 flex items-center gap-2"><Truck className="h-4 w-4 text-slate-400" /><h2 className="text-sm font-semibold text-slate-900">Tedarikçiler</h2></div>
            <DataTable rows={suppliers} columns={supCols} rowKey={(s) => s.id} emptyText="Henüz tedarikçi yok." />
          </section>
        </>
      )}
    </div>
  );
}
