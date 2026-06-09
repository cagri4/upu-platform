"use client";

import { useMemo, useState } from "react";
import {
  siparisler,
  bayiler,
  fmtPara,
  fmtTarihKisa,
  durumLabel,
  type Siparis,
  type SiparisDurum,
} from "../../mock-data";

const durumBg: Record<SiparisDurum, string> = {
  beklemede: "bg-amber-50 text-amber-700 ring-amber-200",
  onaylandi: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  hazirlaniyor: "bg-sky-50 text-sky-700 ring-sky-200",
  yolda: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  teslim: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  iptal: "bg-rose-50 text-rose-700 ring-rose-200",
};

const PAGE_SIZE = 20;

export default function V3Siparisler() {
  const [bayiFiltre, setBayiFiltre] = useState<string>("");
  const [durumFiltre, setDurumFiltre] = useState<string>("");
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [detay, setDetay] = useState<Siparis | null>(null);
  const [sayfa, setSayfa] = useState(1);

  const filtreli = useMemo(() => {
    return siparisler.filter((s) => {
      if (bayiFiltre && s.bayiId !== bayiFiltre) return false;
      if (durumFiltre && s.durum !== durumFiltre) return false;
      return true;
    });
  }, [bayiFiltre, durumFiltre]);

  const sayfaSayisi = Math.max(1, Math.ceil(filtreli.length / PAGE_SIZE));
  const gosterilen = filtreli.slice((sayfa - 1) * PAGE_SIZE, sayfa * PAGE_SIZE);

  const toggle = (id: string) => {
    const ns = new Set(secili);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setSecili(ns);
  };

  // Durum istatistikleri (üst chip strip)
  const istatistik = {
    toplam: filtreli.length,
    beklemede: filtreli.filter((s) => s.durum === "beklemede").length,
    yolda: filtreli.filter((s) => s.durum === "yolda").length,
    teslim: filtreli.filter((s) => s.durum === "teslim").length,
    ciro: filtreli.reduce((s, k) => s + k.tutar, 0),
  };

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <section>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Sipariş yönetimi</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Siparişler</h1>
        <p className="mt-1 text-sm text-slate-600">Filtrele, toplu işle ve detay incele.</p>
      </section>

      {/* İSTATİSTİK STRIP */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Toplam</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{istatistik.toplam}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Beklemede</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-700">{istatistik.beklemede}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Yolda</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-700">{istatistik.yolda}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Teslim</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{istatistik.teslim}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-3 sm:col-span-1">
          <p className="text-[11px] font-medium tracking-wide text-emerald-700 uppercase">Toplam ciro</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-900">{fmtPara(istatistik.ciro)}</p>
        </div>
      </section>

      {/* FİLTRE BAR */}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Bayi</label>
          <select
            value={bayiFiltre}
            onChange={(e) => { setBayiFiltre(e.target.value); setSayfa(1); }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
          >
            <option value="">Tüm bayiler</option>
            {bayiler.map((b) => (
              <option key={b.id} value={b.id}>{b.ad}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Durum</label>
          <select
            value={durumFiltre}
            onChange={(e) => { setDurumFiltre(e.target.value); setSayfa(1); }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
          >
            <option value="">Tümü</option>
            <option value="beklemede">Beklemede</option>
            <option value="onaylandi">Onaylandı</option>
            <option value="hazirlaniyor">Hazırlanıyor</option>
            <option value="yolda">Yolda</option>
            <option value="teslim">Teslim Edildi</option>
            <option value="iptal">İptal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Başlangıç</label>
          <input type="date" defaultValue="2026-05-09" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Bitiş</label>
          <input type="date" defaultValue="2026-06-09" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none" />
        </div>

        <div className="ml-auto flex items-end gap-2">
          {secili.size > 0 && (
            <>
              <span className="text-sm text-slate-600">{secili.size} seçili</span>
              <button type="button" className="h-8 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">Toplu onayla</button>
              <button type="button" className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Reddet</button>
            </>
          )}
          <button type="button" className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ⬇ Dışa aktar
          </button>
        </div>
      </section>

      {/* TABLO + DRAWER */}
      <div className={`grid gap-4 ${detay ? "lg:grid-cols-[1fr_380px]" : ""}`}>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Hepsini seç"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      onChange={(e) => {
                        if (e.target.checked) setSecili(new Set(gosterilen.map((g) => g.id)));
                        else setSecili(new Set());
                      }}
                    />
                  </th>
                  <th className="py-2.5 pr-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Sipariş</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Bayi</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tarih</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Kalem</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tutar</th>
                  <th className="py-2.5 pl-3 pr-5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gosterilen.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setDetay(s)}
                    className={`cursor-pointer transition-colors ${detay?.id === s.id ? "bg-emerald-50/60" : "hover:bg-slate-50/80"}`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={secili.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Seç ${s.siparisNo}`}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="py-2.5 pr-3 font-medium tabular-nums text-slate-900">{s.siparisNo}</td>
                    <td className="px-3 py-2.5 text-slate-700">{s.bayiAd}</td>
                    <td className="px-3 py-2.5 text-slate-600 tabular-nums">{fmtTarihKisa(s.tarih)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{s.kalemSayisi}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{fmtPara(s.tutar)}</td>
                    <td className="py-2.5 pl-3 pr-5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${durumBg[s.durum]}`}>{durumLabel[s.durum]}</span>
                    </td>
                  </tr>
                ))}
                {gosterilen.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">Bu filtreyle hiç sipariş bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>{filtreli.length} kayıt · Sayfa {sayfa} / {sayfaSayisi}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.max(1, p - 1))}
                disabled={sayfa <= 1}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                ← Önceki
              </button>
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.min(sayfaSayisi, p + 1))}
                disabled={sayfa >= sayfaSayisi}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Sonraki →
              </button>
            </div>
          </div>
        </section>

        {/* DRAWER */}
        {detay && (
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">{detay.siparisNo}</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{detay.bayiAd}</h3>
                <p className="text-xs text-slate-500">{fmtTarihKisa(detay.tarih)}</p>
              </div>
              <button type="button" onClick={() => setDetay(null)} aria-label="Kapat" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-3">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${durumBg[detay.durum]}`}>{durumLabel[detay.durum]}</span>
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Kalemler</p>
              <div className="flex flex-col divide-y divide-slate-100 text-sm">
                {detay.kalemler.map((k) => (
                  <div key={k.urunId} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="text-slate-700">{k.urunAd}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{k.miktar} {k.birim} × {fmtPara(k.birimFiyat)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Toplam</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">{fmtPara(detay.tutar)}</span>
              </div>
            </div>
            {detay.not && (
              <div className="border-t border-slate-100 bg-amber-50 px-5 py-3">
                <p className="text-xs font-medium text-amber-800">Not: {detay.not}</p>
              </div>
            )}
            <div className="flex gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" className="h-9 flex-1 rounded-md bg-emerald-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">Onayla</button>
              <button type="button" className="h-9 flex-1 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Reddet</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
