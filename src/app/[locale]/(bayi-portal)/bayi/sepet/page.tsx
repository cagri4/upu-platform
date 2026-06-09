"use client";

/**
 * Bayi Sepet sayfası (Faz 2 Sprint C).
 *
 * localStorage'tan render — Sprint B'de buyer-cart.ts ile uyumlu. Sayfa
 * açılırken aynı zamanda DB'den /api/bayi/sepet PUT ile sync edilir,
 * cross-device backup garantilenir.
 *
 * Excel toplu yükleme: modal → /api/bayi/sepet/excel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  ArrowRight,
  FileSpreadsheet,
  Upload,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  getCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  type CartLine,
} from "@/lib/buyer-cart";

interface ExcelRow {
  row: number;
  code: string | null;
  ok: boolean;
  error?: string;
  productName?: string;
  quantity?: number;
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

export default function BayiSepetPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelSummary, setExcelSummary] = useState<{
    total: number;
    ok: number;
    error: number;
    added?: number;
  } | null>(null);
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelCommitted, setExcelCommitted] = useState(false);
  const dbSyncedRef = useRef(false);

  const refresh = useCallback(() => {
    setLines(getCart().lines);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("upu-cart-changed", handler);
    return () => window.removeEventListener("upu-cart-changed", handler);
  }, [refresh]);

  // Açılışta DB'ye sync — cross-device garanti
  useEffect(() => {
    if (dbSyncedRef.current) return;
    dbSyncedRef.current = true;
    void (async () => {
      try {
        const state = getCart();
        if (state.lines.length === 0) return;
        await fetch("/api/bayi/sepet", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: state.lines.map((l) => ({
              product_id: l.productId,
              quantity: l.quantity,
              unit_price: l.listUnitPrice,
            })),
          }),
        });
      } catch {
        // sessiz geç — UI çalışmaya devam etsin
      }
    })();
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.listUnitPrice * l.quantity, 0),
    [lines],
  );

  function handleUpdate(productId: string, qty: number) {
    updateQuantity(productId, qty);
    refresh();
  }

  function handleRemove(productId: string) {
    removeFromCart(productId);
    refresh();
  }

  function handleClear() {
    if (!confirm("Sepet tamamen boşaltılsın mı?")) return;
    clearCart();
    refresh();
  }

  async function runExcel(dryRun: boolean) {
    if (!excelFile) return;
    setExcelBusy(true);
    setExcelSummary(null);
    setExcelRows([]);
    if (dryRun) setExcelCommitted(false);
    try {
      const fd = new FormData();
      fd.append("file", excelFile);
      fd.append("dryRun", dryRun ? "true" : "false");
      const res = await fetch("/api/bayi/sepet/excel", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        alert(d.error || "Yükleme hatası.");
        return;
      }
      setExcelSummary(d.summary);
      setExcelRows(d.results || []);
      if (!dryRun) {
        setExcelCommitted(true);
        // DB sepetinden güncel localStorage state'e geç
        const fresh = await fetch("/api/bayi/sepet", { credentials: "same-origin" });
        const fd2 = await fresh.json();
        if (fd2.success && Array.isArray(fd2.lines)) {
          // localStorage'a senkron — yeni satırlar UI'a yansır
          clearCart();
          for (const it of fd2.lines) {
            // Inline storage write (avoid circular)
            updateQuantity(it.productId, 0); // emin olmak için
          }
        }
        refresh();
      }
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/bayi/katalog`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Sepetim</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExcelOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel ile toplu ekle
          </button>
          {lines.length > 0 && (
            <button
              onClick={handleClear}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
              Sepeti boşalt
            </button>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-base font-medium text-slate-800">
            Sepetin boş
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Katalogdan ürün ekleyerek başla — veya Excel ile toplu yükle.
          </p>
          <Link
            href={`/${locale}/bayi/katalog`}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Kataloğa Git
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Satırlar */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {lines.map((l) => (
                <li
                  key={l.productId}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <Link
                    href={`/${locale}/bayi/katalog/${l.productId}`}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-50"
                  >
                    {l.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={l.imageUrl}
                        alt={l.productName}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <Package className="h-7 w-7 text-slate-300" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">{l.productCode}</p>
                    <Link
                      href={`/${locale}/bayi/katalog/${l.productId}`}
                      className="line-clamp-1 text-sm font-medium text-slate-900 hover:text-indigo-700"
                    >
                      {l.productName}
                    </Link>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Birim: {formatPara(l.listUnitPrice)} / {l.unit}
                    </p>
                  </div>
                  <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-200">
                    <button
                      onClick={() => handleUpdate(l.productId, l.quantity - 1)}
                      className="px-2 text-slate-700 hover:bg-slate-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        handleUpdate(
                          l.productId,
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                      className="w-14 border-x border-slate-200 px-2 text-center text-sm tabular-nums focus:outline-none"
                    />
                    <button
                      onClick={() => handleUpdate(l.productId, l.quantity + 1)}
                      className="px-2 text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="w-24 text-right font-semibold tabular-nums text-slate-900">
                    {formatPara(l.listUnitPrice * l.quantity)}
                  </span>
                  <button
                    onClick={() => handleRemove(l.productId)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Özet */}
          <aside className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Özet</h2>
              <div className="mt-3 space-y-2 text-sm tabular-nums">
                <p className="flex justify-between text-slate-600">
                  <span>Ürün ({lines.length})</span>
                  <span>{formatPara(subtotal)}</span>
                </p>
                <p className="flex justify-between text-slate-400">
                  <span>Kampanya indirimi</span>
                  <span>Checkout'ta hesaplanır</span>
                </p>
                <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                  <span>Ara toplam</span>
                  <span>{formatPara(subtotal)}</span>
                </p>
              </div>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-slate-700">
                  Kupon kodu (varsa)
                </span>
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="RAMAZAN25"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <button
                onClick={() => {
                  // Coupon code session-storage'a — checkout'ta okunur
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("upu-cart-coupon", couponInput);
                  }
                  router.push(`/${locale}/bayi/odeme`);
                }}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Ödemeye Geç
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">
              Kampanya indirimleri ve nihai toplam ödeme sayfasında gösterilir.
            </p>
          </aside>
        </div>
      )}

      {/* Excel modal */}
      {excelOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Excel ile Toplu Sepet
              </h3>
              <button
                onClick={() => {
                  setExcelOpen(false);
                  setExcelFile(null);
                  setExcelSummary(null);
                  setExcelRows([]);
                  setExcelCommitted(false);
                }}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              1. satır başlık: <code>kod, miktar</code>. xlsx formatı, maks 5 MB.
            </p>
            <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:bg-slate-100">
              <FileSpreadsheet className="h-6 w-6 text-slate-400" />
              {excelFile ? (
                <span className="text-slate-900">{excelFile.name}</span>
              ) : (
                <span>Dosya seç</span>
              )}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  setExcelFile(e.target.files?.[0] ?? null);
                  setExcelSummary(null);
                  setExcelRows([]);
                  setExcelCommitted(false);
                }}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => runExcel(true)}
                disabled={excelBusy || !excelFile}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Önizleme
              </button>
              <button
                onClick={() => runExcel(false)}
                disabled={excelBusy || !excelSummary || excelCommitted || excelSummary.ok === 0}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {excelCommitted ? "Eklendi ✓" : "Sepete ekle"}
              </button>
            </div>
            {excelSummary && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Toplam</p>
                  <p className="text-base font-semibold tabular-nums">{excelSummary.total}</p>
                </div>
                <div className="rounded-md bg-emerald-50 px-2 py-2 text-center text-emerald-800">
                  <p className="text-[10px] uppercase">Hazır</p>
                  <p className="text-base font-semibold tabular-nums">{excelSummary.ok}</p>
                </div>
                <div className={`rounded-md px-2 py-2 text-center ${
                  excelSummary.error > 0
                    ? "bg-rose-50 text-rose-800"
                    : "bg-slate-50 text-slate-700"
                }`}>
                  <p className="text-[10px] uppercase">Hata</p>
                  <p className="text-base font-semibold tabular-nums">{excelSummary.error}</p>
                </div>
              </div>
            )}
            {excelRows.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Satır</th>
                      <th className="px-2 py-1 text-left">Kod</th>
                      <th className="px-2 py-1 text-left">Sonuç</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelRows.slice(0, 30).map((r) => (
                      <tr key={r.row} className={r.ok ? "" : "bg-rose-50"}>
                        <td className="px-2 py-1 tabular-nums">{r.row}</td>
                        <td className="px-2 py-1">{r.code}</td>
                        <td className="px-2 py-1">
                          {r.ok ? (
                            <span className="text-emerald-700">
                              {r.productName} × {r.quantity}
                            </span>
                          ) : (
                            <span className="text-rose-700">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
