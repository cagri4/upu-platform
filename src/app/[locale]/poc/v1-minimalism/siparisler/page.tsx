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

const durumRenk: Record<SiparisDurum, string> = {
  beklemede: "text-amber-700 bg-amber-50",
  onaylandi: "text-indigo-700 bg-indigo-50",
  hazirlaniyor: "text-sky-700 bg-sky-50",
  yolda: "text-cyan-700 bg-cyan-50",
  teslim: "text-emerald-700 bg-emerald-50",
  iptal: "text-rose-700 bg-rose-50",
};

const PAGE_SIZE = 20;

export default function V1Siparisler() {
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

  return (
    <div className="flex flex-col gap-8">
      {/* HEADER */}
      <section>
        <p className="text-sm text-slate-500">Siparişler · 50 kayıt</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Tüm siparişler</h1>
        <p className="mt-2 text-base text-slate-600">Filtrele, toplu onayla, detaya bak.</p>
      </section>

      {/* FİLTRE BAR — sade, border'lı */}
      <section className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">Bayi</label>
          <select
            value={bayiFiltre}
            onChange={(e) => { setBayiFiltre(e.target.value); setSayfa(1); }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
          >
            <option value="">Tüm bayiler</option>
            {bayiler.map((b) => (
              <option key={b.id} value={b.id}>{b.ad}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">Durum</label>
          <select
            value={durumFiltre}
            onChange={(e) => { setDurumFiltre(e.target.value); setSayfa(1); }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
          >
            <option value="">Tüm durumlar</option>
            <option value="beklemede">Beklemede</option>
            <option value="onaylandi">Onaylandı</option>
            <option value="hazirlaniyor">Hazırlanıyor</option>
            <option value="yolda">Yolda</option>
            <option value="teslim">Teslim Edildi</option>
            <option value="iptal">İptal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">Tarih aralığı</label>
          <input
            type="date"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            defaultValue="2026-05-09"
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          {secili.size > 0 && (
            <>
              <span className="text-sm text-slate-600">{secili.size} seçili</span>
              <button type="button" className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
                Toplu onayla
              </button>
              <button type="button" className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reddet
              </button>
            </>
          )}
        </div>
      </section>

      {/* TABLO + DRAWER YAN YANA */}
      <div className={`grid gap-6 ${detay ? "lg:grid-cols-[1fr_360px]" : ""}`}>
        <section className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-10 py-2.5 pr-2">
                  <input
                    type="checkbox"
                    aria-label="Hepsini seç"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={(e) => {
                      if (e.target.checked) setSecili(new Set(gosterilen.map((g) => g.id)));
                      else setSecili(new Set());
                    }}
                  />
                </th>
                <th className="py-2.5 pr-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Sipariş</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Bayi</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Tarih</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase">Kalem</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase">Tutar</th>
                <th className="py-2.5 pl-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gosterilen.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setDetay(s)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 ${detay?.id === s.id ? "bg-indigo-50/50" : ""}`}
                >
                  <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={secili.has(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`Seç ${s.siparisNo}`}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-3 pr-3 font-medium tabular-nums text-slate-900">{s.siparisNo}</td>
                  <td className="px-3 py-3 text-slate-700">{s.bayiAd}</td>
                  <td className="px-3 py-3 text-slate-600">{fmtTarihKisa(s.tarih)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{s.kalemSayisi}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{fmtPara(s.tutar)}</td>
                  <td className="py-3 pl-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${durumRenk[s.durum]}`}>{durumLabel[s.durum]}</span>
                  </td>
                </tr>
              ))}
              {gosterilen.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">Bu filtreyle hiç sipariş bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* SAYFALAMA */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
            <span>{filtreli.length} kayıt · Sayfa {sayfa} / {sayfaSayisi}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.max(1, p - 1))}
                disabled={sayfa <= 1}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Önceki
              </button>
              <button
                type="button"
                onClick={() => setSayfa((p) => Math.min(sayfaSayisi, p + 1))}
                disabled={sayfa >= sayfaSayisi}
                className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        </section>

        {/* DRAWER */}
        {detay && (
          <aside className="border-l border-slate-200 pl-6 lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{detay.siparisNo}</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{detay.bayiAd}</h3>
                <p className="text-sm text-slate-500">{fmtTarihKisa(detay.tarih)}</p>
              </div>
              <button type="button" onClick={() => setDetay(null)} aria-label="Kapat" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mb-4">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${durumRenk[detay.durum]}`}>{durumLabel[detay.durum]}</span>
            </div>
            <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 text-sm">
              {detay.kalemler.map((k) => (
                <div key={k.urunId} className="flex justify-between gap-3 py-1">
                  <span className="text-slate-700">{k.urunAd}</span>
                  <span className="text-slate-500 tabular-nums">{k.miktar} {k.birim} × {fmtPara(k.birimFiyat)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-b border-slate-100 py-3 text-sm">
              <span className="text-slate-600">Toplam</span>
              <span className="font-semibold tabular-nums text-slate-900">{fmtPara(detay.tutar)}</span>
            </div>
            {detay.not && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Not: {detay.not}</p>
            )}
            <div className="mt-6 flex gap-2">
              <button type="button" className="h-9 flex-1 rounded-md bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700">Onayla</button>
              <button type="button" className="h-9 flex-1 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Reddet</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
