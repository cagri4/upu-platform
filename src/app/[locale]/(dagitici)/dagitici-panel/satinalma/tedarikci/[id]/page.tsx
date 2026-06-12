"use client";

/**
 * Dağıtıcı — Tedarikçi detayı + cari ekstre (Faz 7).
 * Borç/ödenen/kalan özeti + birleşik hareket listesi + ödeme kaydı.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Plus } from "lucide-react";
import { KPICard } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Supplier { id: string; name: string; taxNo: string | null; contactName: string | null; contactPhone: string | null; paymentTermDays: number }
interface Summary { debt: number; paid: number; balance: number }
interface LedgerRow { type: "debt" | "payment"; date: string; label: string; amount: number; ref: string }

export default function TedarikciDetailPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!isBayiFeatureEnabled("bayi.satinalma")) notFound();

  const [sup, setSup] = useState<Supplier | null>(null);
  const [summary, setSummary] = useState<Summary>({ debt: 0, paid: 0, balance: 0 });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [payErr, setPayErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/dagitici/satinalma/tedarikci/${id}`, { credentials: "same-origin" }).then((x) => x.json());
      if (d.success) { setSup(d.supplier); setSummary(d.summary); setLedger(d.ledger); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const addPayment = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setPayErr("Geçerli tutar gir."); return; }
    const res = await fetch(`/api/dagitici/satinalma/tedarikci/${id}/odeme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt, method }) });
    const d = await res.json();
    if (!res.ok || !d.success) { setPayErr(d.error || "Kaydedilemedi."); return; }
    setShowPay(false); setAmount(""); setPayErr("");
    void load();
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>;
  if (!sup) return <div className="text-sm text-slate-500">Tedarikçi bulunamadı.</div>;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/satinalma`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Satın Alma</Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100"><Truck className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{sup.name}</h1>
            <p className="text-sm text-slate-500">{sup.taxNo ? `VKN ${sup.taxNo} · ` : ""}{sup.contactName || ""}{sup.contactPhone ? ` · ${sup.contactPhone}` : ""} · vade {sup.paymentTermDays} gün</p>
          </div>
        </div>
        <button onClick={() => setShowPay((v) => !v)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Ödeme</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Borç" value={`${summary.debt.toLocaleString("tr-TR")} ₺`} />
        <KPICard label="Ödenen" value={`${summary.paid.toLocaleString("tr-TR")} ₺`} />
        <KPICard label="Kalan" value={`${summary.balance.toLocaleString("tr-TR")} ₺`} hint={summary.balance > 0 ? "borçlu" : "kapalı"} />
      </div>

      {showPay && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Ödeme Kaydı</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} step="0.01" placeholder="Tutar (₺)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm tabular-nums" />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
              <option value="transfer">Havale/EFT</option>
              <option value="cash">Nakit</option>
              <option value="check">Çek</option>
            </select>
          </div>
          {payErr && <p className="mt-2 text-xs text-rose-600">{payErr}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={addPayment} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Kaydet</button>
            <button onClick={() => setShowPay(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {/* Cari ekstre */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Cari Ekstre</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {ledger.map((r) => (
            <li key={`${r.type}-${r.ref}`} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${r.type === "debt" ? "bg-rose-400" : "bg-emerald-500"}`} />
                <span className="text-sm text-slate-700">{r.label}</span>
                <span className="text-xs text-slate-400">{new Date(r.date).toLocaleDateString("tr-TR")}</span>
              </div>
              <span className={`text-sm font-medium tabular-nums ${r.type === "debt" ? "text-rose-600" : "text-emerald-600"}`}>{r.type === "debt" ? "+" : "−"}{r.amount.toLocaleString("tr-TR")} ₺</span>
            </li>
          ))}
          {ledger.length === 0 && <li className="py-3 text-center text-xs text-slate-400">Henüz hareket yok.</li>}
        </ul>
      </section>
    </div>
  );
}
