"use client";

import { motion, AnimatePresence } from "motion/react";
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
  beklemede: "bg-amber-100 text-amber-700 ring-amber-200",
  onaylandi: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  hazirlaniyor: "bg-sky-100 text-sky-700 ring-sky-200",
  yolda: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  teslim: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  iptal: "bg-rose-100 text-rose-700 ring-rose-200",
};

const durumGradient: Record<SiparisDurum, string> = {
  beklemede: "from-amber-50 to-white",
  onaylandi: "from-indigo-50 to-white",
  hazirlaniyor: "from-sky-50 to-white",
  yolda: "from-cyan-50 to-white",
  teslim: "from-emerald-50 to-white",
  iptal: "from-rose-50 to-white",
};

const PAGE_SIZE = 20;

export default function V2Siparisler() {
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

  // Durum dağılımı (üst tab'lar)
  const durumlar: { d: SiparisDurum | ""; ad: string; renk: string }[] = [
    { d: "", ad: "Tümü", renk: "from-slate-500 to-slate-600" },
    { d: "beklemede", ad: "Beklemede", renk: "from-amber-400 to-orange-500" },
    { d: "onaylandi", ad: "Onaylandı", renk: "from-indigo-400 to-purple-500" },
    { d: "yolda", ad: "Yolda", renk: "from-cyan-400 to-teal-500" },
    { d: "teslim", ad: "Teslim", renk: "from-emerald-400 to-green-500" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm font-medium text-indigo-600">Siparişler · 50 kayıt</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Tüm <span className="bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent">Siparişler</span>
        </h1>
        <p className="mt-2 text-base text-slate-600">Filtrele, toplu işle, detaya bak.</p>
      </motion.section>

      {/* DURUM PILLS */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {durumlar.map((d) => {
          const aktif = durumFiltre === d.d;
          return (
            <button
              key={d.d || "tum"}
              type="button"
              onClick={() => { setDurumFiltre(d.d); setSayfa(1); }}
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                aktif
                  ? `bg-gradient-to-r ${d.renk} text-white shadow-md`
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {d.ad}
            </button>
          );
        })}
        <div className="ml-auto">
          <select
            value={bayiFiltre}
            onChange={(e) => { setBayiFiltre(e.target.value); setSayfa(1); }}
            className="h-10 rounded-full border-0 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">Tüm bayiler</option>
            {bayiler.map((b) => (
              <option key={b.id} value={b.id}>{b.ad}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* TOPLU İŞLEM SATIRI */}
      <AnimatePresence>
        {secili.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white shadow-lg shadow-indigo-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <span className="text-sm font-bold">{secili.size}</span>
              </div>
              <p className="text-sm font-semibold">sipariş seçildi</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30">Toplu onayla</button>
              <button type="button" onClick={() => setSecili(new Set())} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50">Seçimi kaldır</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SİPARİŞ KART GRİDİ + DETAY */}
      <div className={`grid gap-5 ${detay ? "lg:grid-cols-[1fr_400px]" : ""}`}>
        <motion.section
          className="grid gap-3 sm:grid-cols-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        >
          <AnimatePresence mode="popLayout">
            {gosterilen.map((s, i) => (
              <motion.button
                key={s.id}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ y: -2 }}
                onClick={() => setDetay(s)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${durumGradient[s.durum]} p-4 text-left ring-1 ring-slate-200/60 transition-shadow hover:shadow-lg ${detay?.id === s.id ? "ring-2 ring-indigo-500" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium tabular-nums text-slate-500">{s.siparisNo}</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{s.bayiAd}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={secili.has(s.id)}
                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                    onChange={() => {}}
                    aria-label={`Seç ${s.siparisNo}`}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${durumRenk[s.durum]}`}>
                      {durumLabel[s.durum]}
                    </span>
                    <p className="mt-2 text-xs text-slate-500 tabular-nums">{fmtTarihKisa(s.tarih)} · {s.kalemSayisi} kalem</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900 tabular-nums">{fmtPara(s.tutar)}</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {gosterilen.length === 0 && (
            <div className="col-span-full rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Bu filtreyle hiç sipariş bulunamadı.</p>
            </div>
          )}

          {/* SAYFALAMA */}
          <div className="col-span-full mt-4 flex items-center justify-between rounded-2xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200/60">
            <span className="px-2">{filtreli.length} kayıt · Sayfa {sayfa} / {sayfaSayisi}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSayfa((p) => Math.max(1, p - 1))} disabled={sayfa <= 1} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-slate-200 disabled:opacity-50">← Önceki</button>
              <button type="button" onClick={() => setSayfa((p) => Math.min(sayfaSayisi, p + 1))} disabled={sayfa >= sayfaSayisi} className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">Sonraki →</button>
            </div>
          </div>
        </motion.section>

        {/* DETAY DRAWER */}
        <AnimatePresence>
          {detay && (
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="overflow-hidden rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200/60 lg:sticky lg:top-24 lg:self-start"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium tracking-wide text-indigo-600 uppercase">{detay.siparisNo}</p>
                  <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{detay.bayiAd}</h3>
                  <p className="text-sm text-slate-500">{fmtTarihKisa(detay.tarih)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetay(null)}
                  aria-label="Kapat"
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mb-5">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${durumRenk[detay.durum]}`}>
                  {durumLabel[detay.durum]}
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kalemler</p>
                {detay.kalemler.map((k) => (
                  <div key={k.urunId} className="flex items-start justify-between gap-3 border-b border-slate-200/60 py-2 last:border-0">
                    <span className="text-sm text-slate-700">{k.urunAd}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{k.miktar} {k.birim} × {fmtPara(k.birimFiyat)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
                <span className="text-sm font-medium">Toplam</span>
                <span className="text-2xl font-bold tabular-nums">{fmtPara(detay.tutar)}</span>
              </div>
              {detay.not && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">Not: {detay.not}</p>
              )}
              <div className="mt-5 flex gap-2">
                <button type="button" className="h-10 flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg">Onayla</button>
                <button type="button" className="h-10 flex-1 rounded-full bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50">Reddet</button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
