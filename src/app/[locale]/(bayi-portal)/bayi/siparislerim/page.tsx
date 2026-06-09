"use client";

/**
 * Bayi Sipariş Geçmişi (Faz 2 Sprint D).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Filter, Repeat, Package } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Row {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
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
  delivered: "Teslim edildi",
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BayiSiparislerimPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reorderBusy, setReorderBusy] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/bayi/siparisler?${sp.toString()}`, {
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
  }, [status, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function reorder(orderId: string) {
    setReorderBusy(orderId);
    try {
      const res = await fetch(`/api/bayi/siparisler/${orderId}/tekrar`, {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Tekrar sipariş başarısız.");
        return;
      }
      if (d.skipped > 0) {
        alert(`${d.added} ürün sepete eklendi. ${d.skipped} ürün artık satılmıyor.`);
      } else {
        alert(`${d.added} ürün sepete eklendi.`);
      }
      router.push(`/${locale}/bayi/sepet`);
    } finally {
      setReorderBusy(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Siparişlerim</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} sipariş · sayfa {page}/{totalPages}
          </p>
        </div>
        <Link
          href={`/${locale}/bayi/katalog`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Yeni Sipariş
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Tüm durumlar</option>
            <option value="pending">Bekleyenler</option>
            <option value="approved">Onaylanmış</option>
            <option value="shipped">Kargoda</option>
            <option value="delivered">Teslim edilmiş</option>
            <option value="rejected">Reddedilmiş</option>
            <option value="cancelled">İptal</option>
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
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              Henüz sipariş yok. Katalogdan başla.
            </p>
            <Link
              href={`/${locale}/bayi/katalog`}
              className="mt-2 text-xs font-medium text-indigo-700 hover:underline"
            >
              Kataloğa Git →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
              >
                <div className="flex-1 min-w-[200px]">
                  <Link
                    href={`/${locale}/bayi/siparislerim/${r.id}`}
                    className="text-sm font-medium tabular-nums text-slate-900 hover:text-indigo-700"
                  >
                    #{r.orderNumber}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatTarih(r.createdAt)}
                  </p>
                  {r.couponCode && (
                    <p className="mt-1 text-xs text-slate-500">
                      Kupon: <code className="font-mono">{r.couponCode}</code>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-slate-900">
                    {formatPara(r.totalAmount)}
                  </p>
                  {r.discountAmount > 0 && (
                    <p className="text-xs text-emerald-700 tabular-nums">
                      -{formatPara(r.discountAmount)} indirim
                    </p>
                  )}
                </div>
                <StatusBadge tone={STATUS_TONE[r.status] || "neutral"}>
                  {STATUS_LABEL[r.status] || r.status}
                </StatusBadge>
                <button
                  onClick={() => reorder(r.id)}
                  disabled={reorderBusy === r.id}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  title="Tekrar sipariş"
                >
                  <Repeat className="h-4 w-4" />
                  {reorderBusy === r.id ? "Ekleniyor…" : "Tekrar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}
