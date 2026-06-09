"use client";

/**
 * Bayi Faturalarım (Faz 2 Sprint D).
 *
 * bayi_invoices kayıtları listelenir. pdf_url varsa direkt link, yoksa
 * "Hazır değil" rozeti. Foriba entegrasyonu Faz 3'te bu satırları otomatik
 * doldurur.
 */

import { useCallback, useEffect, useState } from "react";
import { Receipt, Download, AlertTriangle } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Invoice {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  pdfUrl: string | null;
  status: string;
  externalRef: string | null;
  notes: string | null;
}

const STATUS_TONE: Record<string, StatusTone> = {
  open: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Açık",
  paid: "Ödendi",
  overdue: "Vade aşımı",
  cancelled: "İptal",
};

const formatPara = (n: number, cur: string = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function BayiFaturalarimPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({ status });
      const res = await fetch(`/api/bayi/faturalar?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setRows(d.items);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Faturalarım</h1>
        <p className="mt-1 text-sm text-slate-600">
          {rows.length} fatura · vade takibi + PDF indir
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tüm durumlar</option>
          <option value="open">Açık</option>
          <option value="paid">Ödenmiş</option>
          <option value="overdue">Vade aşımı</option>
          <option value="cancelled">İptal</option>
        </select>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Receipt className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              Henüz fatura yok. Sipariş onaylandıkça otomatik faturalanır.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                    Fatura No
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                    Tarih
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                    Vade
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                    Tutar
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                    Durum
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((inv) => {
                  const overdue =
                    inv.status === "open" &&
                    inv.dueDate &&
                    new Date(inv.dueDate) < new Date();
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <p className="font-medium tabular-nums text-slate-900">
                          {inv.invoiceNo}
                        </p>
                        {inv.externalRef && (
                          <p className="text-xs text-slate-500 tabular-nums">
                            Ref: {inv.externalRef}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 tabular-nums">
                        {formatTarih(inv.issueDate)}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">
                        <span className={overdue ? "font-medium text-rose-700" : "text-slate-600"}>
                          {formatTarih(inv.dueDate)}
                        </span>
                        {overdue && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
                            <AlertTriangle className="h-3 w-3" />
                            Vade geçti
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {formatPara(inv.amount, inv.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={STATUS_TONE[inv.status] || "neutral"}>
                          {STATUS_LABEL[inv.status] || inv.status}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {inv.pdfUrl ? (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            İndir
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Hazırlanıyor</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Foriba e-Fatura entegrasyonu Faz 3'te canlıya alınacak; o zaman
        siparişin onaylanmasıyla fatura otomatik kesilip burada PDF olarak görünecek.
      </p>
    </div>
  );
}
