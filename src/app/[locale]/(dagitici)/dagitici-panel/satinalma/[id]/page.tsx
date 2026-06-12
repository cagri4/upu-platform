"use client";

/**
 * Dağıtıcı — PO detayı (Faz 7). Durum akışı + PO'dan mal kabul (Faz 5 wiring).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, PackageCheck, Lock } from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface POHead { id: string; poNumber: string; supplierId: string; supplierName: string; status: string; expectedDate: string | null; total: number; note: string | null; paymentTermDays: number }
interface POLine { id: string; productCode: string; productName: string; quantity: number; receivedQty: number; remaining: number; unitPrice: number; lineTotal: number }
interface Warehouse { id: string; name: string }

const STATUS_LABEL: Record<string, string> = { draft: "Taslak", sent: "Gönderildi", partial: "Kısmi Kabul", received: "Tamamen Kabul", closed: "Kapandı" };
const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = { draft: "neutral", sent: "info", partial: "warning", received: "success", closed: "neutral" };

export default function PODetailPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!isBayiFeatureEnabled("bayi.satinalma")) notFound();

  const [po, setPo] = useState<POHead | null>(null);
  const [lines, setLines] = useState<POLine[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [whId, setWhId] = useState("");
  const [recv, setRecv] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, w] = await Promise.all([
        fetch(`/api/dagitici/satinalma/${id}`, { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/depo", { credentials: "same-origin" }).then((x) => x.json()),
      ]);
      if (d.success) { setPo(d.po); setLines(d.lines); }
      if (w.success) { setWarehouses(w.items); if (w.items[0]) setWhId((cur) => cur || w.items[0].id); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (status: string) => {
    const res = await fetch(`/api/dagitici/satinalma/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const d = await res.json();
    if (!res.ok || !d.success) { setMsg(d.error || "Geçiş başarısız."); return; }
    setMsg(""); void load();
  };

  const doReceive = async () => {
    if (!whId) { setMsg("Depo seç."); return; }
    const recvLines = Object.entries(recv).filter(([, q]) => q > 0).map(([line_id, received_qty]) => ({ line_id, received_qty }));
    if (recvLines.length === 0) { setMsg("Gelen adet gir."); return; }
    setMsg("Mal kabul yapılıyor…");
    const res = await fetch(`/api/dagitici/satinalma/${id}/mal-kabul`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warehouse_id: whId, lines: recvLines }) });
    const d = await res.json();
    if (!res.ok || !d.success) { setMsg(d.error || "Mal kabul başarısız."); return; }
    setMsg(`Mal kabul tamam — PO durumu: ${STATUS_LABEL[d.status] || d.status}`);
    setRecv({});
    void load();
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>;
  if (!po) return <div className="text-sm text-slate-500">PO bulunamadı.</div>;

  const canReceive = ["sent", "partial"].includes(po.status);

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/satinalma`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Satın Alma</Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{po.poNumber}</h1>
            <StatusBadge tone={STATUS_TONE[po.status] || "neutral"}>{STATUS_LABEL[po.status] || po.status}</StatusBadge>
          </div>
          <p className="text-sm text-slate-500">
            <Link href={`/${locale}/dagitici-panel/satinalma/tedarikci/${po.supplierId}`} className="hover:underline">{po.supplierName}</Link>
            {po.expectedDate ? ` · teslim ${po.expectedDate}` : ""} · vade {po.paymentTermDays} gün
          </p>
        </div>
        <div className="flex gap-2">
          {po.status === "draft" && <button onClick={() => setStatus("sent")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"><Send className="h-4 w-4" /> Tedarikçiye Gönder</button>}
          {["sent", "partial", "received"].includes(po.status) && <button onClick={() => setStatus("closed")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Lock className="h-4 w-4" /> Kapat</button>}
        </div>
      </div>

      {msg && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">{msg}</p>}

      {/* Satırlar */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Ürün</th>
              <th className="px-3 py-2 text-right font-semibold">Sipariş</th>
              <th className="px-3 py-2 text-right font-semibold">Gelen</th>
              <th className="px-3 py-2 text-right font-semibold">Kalan</th>
              <th className="px-3 py-2 text-right font-semibold">B.Fiyat</th>
              <th className="px-3 py-2 text-right font-semibold">Tutar</th>
              {canReceive && <th className="px-3 py-2 text-right font-semibold">Mal Kabul</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2"><div className="font-medium text-slate-800">{l.productName}</div><div className="text-xs text-slate-400">{l.productCode}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{l.receivedQty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.remaining}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.unitPrice.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{l.lineTotal.toLocaleString("tr-TR")} ₺</td>
                {canReceive && (
                  <td className="px-3 py-2 text-right">
                    {l.remaining > 0 ? (
                      <input type="number" min={0} max={l.remaining} value={recv[l.id] ?? ""} onChange={(e) => setRecv((r) => ({ ...r, [l.id]: Math.min(l.remaining, Math.max(0, Math.floor(Number(e.target.value)))) }))} placeholder="0" className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm tabular-nums" />
                    ) : <span className="text-xs text-emerald-600">tam</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Toplam</td>
              <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{po.total.toLocaleString("tr-TR")} ₺</td>
              {canReceive && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {canReceive && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><PackageCheck className="h-4 w-4 text-emerald-600" /> PO&apos;dan Mal Kabul</h2>
          <p className="mt-1 text-xs text-slate-500">Gelen adetleri yukarıdaki satırlara gir, depoyu seç ve onayla. Stok Faz 5 deposuna işlenir.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={whId} onChange={(e) => setWhId(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
              <option value="">Depo seç…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button onClick={doReceive} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"><PackageCheck className="h-4 w-4" /> Mal Kabul Et</button>
          </div>
        </div>
      )}
    </div>
  );
}
