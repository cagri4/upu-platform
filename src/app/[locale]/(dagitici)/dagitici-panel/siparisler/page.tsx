"use client";

/**
 * Sipariş kuyruğu — bekleyenler önce sıralı, toplu işlem checkbox + footer
 * action.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Row {
  id: string;
  orderNumber: string;
  dealerName: string;
  dealerSegment: string | null;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  preparing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim",
  cancelled: "İptal",
};

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function SiparislerListPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState<"approve" | "reject" | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const sp = new URLSearchParams({
        q,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/dagitici/siparisler?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setRows(d.items);
      setTotal(d.total);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const pendingSelectedCount = useMemo(
    () =>
      rows.filter((r) => selected.has(r.id) && r.status === "pending").length,
    [rows, selected],
  );

  async function runBulk(kind: "approve" | "reject") {
    setBulkSaving(true);
    try {
      const ids = rows
        .filter((r) => selected.has(r.id) && r.status === "pending")
        .map((r) => r.id);
      if (ids.length === 0) {
        alert("Seçili pending sipariş yok.");
        return;
      }
      const url =
        kind === "approve"
          ? "/api/dagitici/siparisler/toplu-onay"
          : "/api/dagitici/siparisler/toplu-red";
      const body =
        kind === "approve"
          ? { order_ids: ids }
          : { order_ids: ids, reason: bulkReason };
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Hata.");
        return;
      }
      const sum = d.summary;
      alert(`${sum.ok}/${sum.total} işlem başarılı, ${sum.error} hata.`);
      setBulkOpen(null);
      setBulkReason("");
      load();
    } finally {
      setBulkSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Siparişler</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} sipariş · sayfa {page}/{totalPages}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Sipariş numarası"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="pending">Bekleyenler</option>
            <option value="approved">Onaylanmış</option>
            <option value="rejected">Reddedilmiş</option>
            <option value="">Hepsi</option>
          </select>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-8 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-emerald-600"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Sipariş No
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Bayi
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tarih
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Toplam
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm text-slate-500"
                    >
                      Bu filtrede sipariş yok.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/60 ${
                        selected.has(r.id) ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          className="accent-emerald-600"
                        />
                      </td>
                      <td
                        className="cursor-pointer px-3 py-3 tabular-nums"
                        onClick={() =>
                          router.push(
                            `/${locale}/dagitici-panel/siparisler/${r.id}`,
                          )
                        }
                      >
                        <span className="font-medium text-slate-900">
                          {r.orderNumber}
                        </span>
                      </td>
                      <td
                        className="cursor-pointer px-3 py-3"
                        onClick={() =>
                          router.push(
                            `/${locale}/dagitici-panel/siparisler/${r.id}`,
                          )
                        }
                      >
                        <p className="text-sm text-slate-900">{r.dealerName}</p>
                        {r.dealerSegment && (
                          <p className="text-xs text-slate-500">
                            Segment {r.dealerSegment}
                          </p>
                        )}
                      </td>
                      <td
                        className="cursor-pointer px-3 py-3 text-xs text-slate-600 tabular-nums"
                        onClick={() =>
                          router.push(
                            `/${locale}/dagitici-panel/siparisler/${r.id}`,
                          )
                        }
                      >
                        {formatTarih(r.createdAt)}
                      </td>
                      <td
                        className="cursor-pointer px-3 py-3 text-right tabular-nums"
                        onClick={() =>
                          router.push(
                            `/${locale}/dagitici-panel/siparisler/${r.id}`,
                          )
                        }
                      >
                        <span className="font-medium text-slate-900">
                          {formatPara(r.totalAmount)}
                        </span>
                        {r.discountAmount > 0 && (
                          <p className="text-xs text-emerald-700">
                            -{formatPara(r.discountAmount)}
                          </p>
                        )}
                      </td>
                      <td
                        className="cursor-pointer px-3 py-3"
                        onClick={() =>
                          router.push(
                            `/${locale}/dagitici-panel/siparisler/${r.id}`,
                          )
                        }
                      >
                        <StatusBadge tone={STATUS_TONE[r.status] || "neutral"}>
                          {STATUS_LABEL[r.status] || r.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected.size > 0 && pendingSelectedCount > 0 && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{pendingSelectedCount}</span> bekleyen
            sipariş seçili
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkOpen("approve")}
              disabled={bulkSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Toplu Onayla
            </button>
            <button
              onClick={() => setBulkOpen("reject")}
              disabled={bulkSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-700 hover:bg-rose-100"
            >
              <XCircle className="h-4 w-4" />
              Toplu Reddet
            </button>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Önceki
          </button>
          <span className="text-slate-500">
            Sayfa {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {bulkOpen === "approve"
                ? `${pendingSelectedCount} siparişi onayla`
                : `${pendingSelectedCount} siparişi reddet`}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {bulkOpen === "approve"
                ? "Tüm seçili bekleyen siparişler onaylanacak ve bayilere bildirim gidecek (Faz 4)."
                : "Tüm seçili siparişler reddedilecek. Tek bir sebep notu girersin."}
            </p>
            {bulkOpen === "reject" && (
              <textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Stok kalmadı / kredi limiti aşıldı / vb."
                rows={3}
                className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setBulkOpen(null);
                  setBulkReason("");
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={() => runBulk(bulkOpen)}
                disabled={bulkSaving || (bulkOpen === "reject" && !bulkReason.trim())}
                className={`h-9 rounded-lg px-3 text-sm font-medium text-white disabled:opacity-60 ${
                  bulkOpen === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {bulkSaving ? "İşleniyor…" : bulkOpen === "approve" ? "Onayla" : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
