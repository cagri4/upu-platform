"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  kpi,
  sonSiparisler,
  gecikenBayiler,
  fmtPara,
  fmtTarihKisa,
  durumLabel,
  type SiparisDurum,
} from "../../mock-data";

// V2 — BENTO GRID DASHBOARD
// Modüler renkli bloklar, glassmorphism, gradient'ler, stagger animasyon.

const durumRenk: Record<SiparisDurum, string> = {
  beklemede: "bg-amber-100 text-amber-700 ring-amber-200",
  onaylandi: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  hazirlaniyor: "bg-sky-100 text-sky-700 ring-sky-200",
  yolda: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  teslim: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  iptal: "bg-rose-100 text-rose-700 ring-rose-200",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function V2Dashboard() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  return (
    <div className="flex flex-col gap-8">
      {/* HEADER */}
      <motion.section initial="hidden" animate="show" variants={container}>
        <motion.p variants={item} className="text-sm font-medium text-indigo-600">Pazartesi, 9 Haziran 2026</motion.p>
        <motion.h1 variants={item} className="mt-1 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Hoşgeldin, <span className="bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent">Mehmet Bey</span>
        </motion.h1>
        <motion.p variants={item} className="mt-2 max-w-2xl text-base text-slate-600">
          Gıda toptancısı kontrol paneli. Bugünkü hareket aşağıda — geciken bayiler bekliyor.
        </motion.p>
      </motion.section>

      {/* BENTO GRID — 6 kolon, farklı boyutlu bloklar */}
      <motion.section
        className="grid grid-cols-2 gap-4 md:grid-cols-6 md:gap-5"
        initial="hidden"
        animate="show"
        variants={container}
      >
        {/* BLOK 1 — Bugünkü ciro (BÜYÜK, 4x2) */}
        <motion.div
          variants={item}
          whileHover={{ scale: 1.01 }}
          className="group relative col-span-2 row-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 p-6 text-white shadow-xl shadow-indigo-500/20 md:col-span-4"
        >
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-white/80">Bugünkü Ciro</p>
            <p className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">{fmtPara(kpi.bugunkuCiro)}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>
              +18% dün ile karşılaştır
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                <p className="text-xs text-white/70">Sipariş</p>
                <p className="text-xl font-semibold">{kpi.bugunkuSiparis}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                <p className="text-xs text-white/70">Ort. tutar</p>
                <p className="text-xl font-semibold">{fmtPara(Math.round(kpi.bugunkuCiro / Math.max(1, kpi.bugunkuSiparis)))}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* BLOK 2 — Bekleyen onay */}
        <motion.div
          variants={item}
          whileHover={{ scale: 1.02 }}
          className="col-span-1 row-span-1 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 ring-1 ring-amber-200/60 md:col-span-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-200/60">
            <svg className="h-5 w-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="mt-3 text-xs font-medium tracking-wide text-amber-700/80 uppercase">Bekleyen onay</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{kpi.bekleyenOnay}</p>
          <p className="text-xs text-amber-700">en eski 4 saat önce</p>
        </motion.div>

        {/* BLOK 3 — Geciken bayi */}
        <motion.div
          variants={item}
          whileHover={{ scale: 1.02 }}
          className="col-span-1 row-span-1 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-100 via-rose-50 to-white p-5 ring-1 ring-rose-200/60 md:col-span-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-200/60">
            <svg className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="mt-3 text-xs font-medium tracking-wide text-rose-700/80 uppercase">Geciken bayi</p>
          <p className="mt-1 text-3xl font-bold text-rose-900">{kpi.gecikenBayi}</p>
          <p className="text-xs text-rose-700">aksiyon gerek</p>
        </motion.div>

        {/* BLOK 4 — Geciken bayiler listesi (genis) */}
        <motion.div
          variants={item}
          whileHover={{ scale: 1.005 }}
          className="col-span-2 row-span-2 overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 md:col-span-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Bu hafta gecikenler</h2>
              <p className="text-xs text-slate-500">2+ haftadır sipariş yok</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100">
              <span className="text-sm font-bold text-rose-600">{gecikenBayiler.length}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {gecikenBayiler.map((b) => (
              <div key={b.id} className="rounded-2xl bg-gradient-to-r from-rose-50 to-white p-3 ring-1 ring-rose-100/60">
                <p className="text-sm font-semibold text-slate-900">{b.ad}</p>
                <p className="text-xs text-slate-500">{b.sehir} · {b.yetkili}</p>
                <p className="mt-1 text-xs font-medium text-rose-600">Son: {fmtTarihKisa(b.sonSiparis)}</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 w-full rounded-2xl bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 hover:shadow-md">
            Hatırlatma gönder
          </button>
        </motion.div>

        {/* BLOK 5 — Hızlı aksiyonlar (yatay 4 kolon) */}
        <motion.div
          variants={item}
          className="col-span-2 row-span-1 grid grid-cols-2 gap-3 md:col-span-4 md:grid-cols-3"
        >
          {[
            { ad: "Yeni kampanya", icon: "M12 4v16m8-8H4", grad: "from-emerald-400 to-teal-500" },
            { ad: `${kpi.bekleyenOnay} onay bekliyor`, icon: "M5 13l4 4L19 7", grad: "from-indigo-400 to-purple-500" },
            { ad: "Bayi davet et", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", grad: "from-amber-400 to-orange-500" },
          ].map((a, i) => (
            <motion.button
              key={i}
              type="button"
              whileHover={{ y: -2, scale: 1.02 }}
              className={`relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl bg-gradient-to-br ${a.grad} p-4 text-left text-white shadow-md transition-shadow hover:shadow-lg`}
            >
              <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-white/20 blur-2xl" />
              <svg className="relative h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} /></svg>
              <span className="relative text-sm font-semibold">{a.ad}</span>
            </motion.button>
          ))}
        </motion.div>
      </motion.section>

      {/* SON SİPARİŞLER — bento dışı, kart liste */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Son siparişler</h2>
            <p className="text-sm text-slate-500">Son 24 saatte alınan 10 sipariş</p>
          </div>
          <Link
            href={`/${locale}/poc/v2-bento/siparisler`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100 transition-all hover:bg-indigo-50 hover:shadow-md"
          >
            Tümünü gör
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sonSiparisler.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.03, duration: 0.3 }}
              whileHover={{ y: -2 }}
              className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${durumRenk[s.durum]}`}>
                  {durumLabel[s.durum]}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">{fmtTarihKisa(s.tarih)}</span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900">{s.bayiAd}</p>
              <p className="text-xs text-slate-500 tabular-nums">{s.siparisNo} · {s.kalemSayisi} kalem</p>
              <p className="mt-3 text-lg font-bold tracking-tight text-slate-900 tabular-nums">{fmtPara(s.tutar)}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
