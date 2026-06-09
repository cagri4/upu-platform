"use client";

/**
 * Excel toplu ürün import.
 * Adımlar: dosya seç → "Dry-run" (önizleme) → "Yükle" (commit).
 *
 * Beklenen Excel sütun başlıkları:
 *   kod, isim, açıklama, kategori, birim, barkod, base_price, stok,
 *   min_stok, min_siparis, marka
 *
 * Sample template indirme linki ile başlangıç şablonu sağlanır.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Upload, Download } from "lucide-react";

interface RowResult {
  row: number;
  ok: boolean;
  error?: string;
  code?: string;
  name?: string;
}

interface ImportSummary {
  total: number;
  ok: number;
  error: number;
  rowsExceeded: boolean;
  inserted?: number;
}

export default function UrunImportPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [sample, setSample] = useState<RowResult[]>([]);
  const [committed, setCommitted] = useState(false);

  async function runImport(dryRun: boolean) {
    if (!file) {
      setError("Önce dosya seç.");
      return;
    }
    setBusy(true);
    setError("");
    if (dryRun) {
      setSummary(null);
      setSample([]);
      setCommitted(false);
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dryRun", dryRun ? "true" : "false");
      const res = await fetch("/api/dagitici/urunler/import", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yükleme başarısız.");
        return;
      }
      setSummary(d.summary);
      if (d.sample) setSample(d.sample);
      if (!dryRun) setCommitted(true);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  function downloadSampleTemplate() {
    // İlk satır = başlıklar, sonraki 3 satır = örnek
    const csv = [
      "kod,isim,açıklama,kategori,birim,barkod,base_price,stok,min_stok,min_siparis,marka",
      "SP-500,Spagetti 500g,İnce makarna 500g,Makarna,koli,8690000000001,25,100,10,1,Markam",
      "KN-400,Konserve Bezelye 400g,,Konserve,adet,8690000000002,18,200,20,1,Markam",
      "RZ-1000,Pirinç 1kg,Baldo pirinç,Bakliyat,koli,8690000000003,45,50,5,1,Markam",
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "urun-sablonu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/dagitici-panel/urunler`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Excel ile Toplu Ürün</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">1) Dosya seç</h2>
          <p className="mt-1 text-xs text-slate-500">
            xlsx formatı önerilir. Başlık satırı: <code>kod, isim, açıklama, kategori, birim, barkod, base_price, stok, min_stok, min_siparis, marka</code>
          </p>

          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600 hover:bg-slate-100">
            <FileSpreadsheet className="h-6 w-6 text-slate-400" />
            {file ? (
              <span className="text-slate-900">{file.name}</span>
            ) : (
              <span>Dosya seç (xlsx, maks 5 MB)</span>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setSummary(null);
                setSample([]);
                setCommitted(false);
                setError("");
              }}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => runImport(true)}
              disabled={busy || !file}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {busy ? "İşleniyor…" : "2) Dry-run önizleme"}
            </button>
            <button
              onClick={() => runImport(false)}
              disabled={busy || !summary || committed || summary.ok === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {committed ? "Yüklendi ✓" : "3) Veritabanına yükle"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          {summary && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Stat label="Toplam satır" value={summary.total} />
              <Stat label="Hazır" value={summary.ok} tone="success" />
              <Stat label="Hatalı" value={summary.error} tone={summary.error > 0 ? "danger" : "neutral"} />
              {summary.inserted != null && (
                <Stat
                  label="Yüklenen"
                  value={summary.inserted}
                  tone="success"
                  className="sm:col-span-3"
                />
              )}
              {summary.rowsExceeded && (
                <p className="text-xs text-amber-700 sm:col-span-3">
                  Dosyada 1000+ satır var; yalnızca ilk 1000 işlendi.
                </p>
              )}
            </div>
          )}

          {sample.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Satır</th>
                    <th className="px-2 py-1.5">Kod</th>
                    <th className="px-2 py-1.5">İsim</th>
                    <th className="px-2 py-1.5">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sample.map((s) => (
                    <tr key={s.row} className={s.ok ? "" : "bg-rose-50"}>
                      <td className="px-2 py-1.5 tabular-nums">{s.row}</td>
                      <td className="px-2 py-1.5">{s.code || "—"}</td>
                      <td className="px-2 py-1.5">{s.name || "—"}</td>
                      <td className="px-2 py-1.5">
                        {s.ok ? (
                          <span className="text-emerald-700">OK</span>
                        ) : (
                          <span className="text-rose-700">{s.error || "hata"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {committed && (
            <div className="mt-4">
              <button
                onClick={() => router.push(`/${locale}/dagitici-panel/urunler`)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Ürün listesine git →
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Şablon</h2>
          <p className="mt-1 text-xs text-slate-500">
            Aşağıdan örnek şablonu indir, doldurup yükle.
          </p>
          <button
            onClick={downloadSampleTemplate}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Örnek CSV indir
          </button>
          <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
            <li>• <code>kod</code> ve <code>isim</code> zorunlu</li>
            <li>• Kategori isim olarak gelir; sistemde yoksa boş bırakılır</li>
            <li>• Boş hücreler varsayılan değerle doldurulur</li>
            <li>• Dosyada 1000 satır limit vardır</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "danger";
  className?: string;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls} ${className}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
