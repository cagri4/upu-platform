import Link from "next/link";
import {
  kpi,
  sonSiparisler,
  gecikenBayiler,
  haftalikCiro,
  fmtPara,
  fmtTarihKisa,
  durumLabel,
  type SiparisDurum,
} from "../../mock-data";

// V3 — MODERN DASHBOARD
// Stripe / Banking inspired. Sidebar layout, kart-merkezli, dense data,
// chart entegrasyonu (SVG bar chart), emerald accent.

const durumBg: Record<SiparisDurum, string> = {
  beklemede: "bg-amber-50 text-amber-700 ring-amber-200",
  onaylandi: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  hazirlaniyor: "bg-sky-50 text-sky-700 ring-sky-200",
  yolda: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  teslim: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  iptal: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function V3Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const maxCiro = Math.max(...haftalikCiro.map((c) => c.tutar), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Pazartesi, 9 Haziran 2026</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hoşgeldin, Mehmet Bey</h1>
          <p className="mt-1 text-sm text-slate-600">Gıda toptancısı kontrol paneli</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Bu hafta
          </button>
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Sipariş
          </button>
        </div>
      </section>

      {/* KPI KARTLARI — 4'lü grid */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { ad: "Bugünkü sipariş", deger: kpi.bugunkuSiparis.toString(), alt: "+3 dün ile karşılaştır", delta: "+25%", deltaRenk: "text-emerald-600" },
          { ad: "Bugünkü ciro", deger: fmtPara(kpi.bugunkuCiro), alt: "Hedefin %78'i", delta: "+18%", deltaRenk: "text-emerald-600" },
          { ad: "Bekleyen onay", deger: kpi.bekleyenOnay.toString(), alt: "En eski 4 saat önce", delta: "Aksiyon gerek", deltaRenk: "text-amber-600" },
          { ad: "Geciken bayi", deger: kpi.gecikenBayi.toString(), alt: "2+ haftadır sipariş yok", delta: "−1 hafta önce", deltaRenk: "text-rose-600" },
        ].map((k) => (
          <div key={k.ad} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{k.ad}</p>
              <span className={`text-xs font-semibold tabular-nums ${k.deltaRenk}`}>{k.delta}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{k.deger}</p>
            <p className="mt-1 text-xs text-slate-500">{k.alt}</p>
          </div>
        ))}
      </section>

      {/* HAFTALIK CİRO CHART + GECİKEN BAYİLER */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* CHART */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Haftalık ciro</h2>
              <p className="text-xs text-slate-500">Son 7 gün</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Ciro (₺)
              </span>
            </div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3 sm:gap-5">
            {haftalikCiro.map((c, i) => {
              const ratio = c.tutar / maxCiro;
              const isToday = i === haftalikCiro.length - 1;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className={`group relative w-full rounded-t-md transition-all hover:opacity-90 ${isToday ? "bg-gradient-to-t from-emerald-600 to-emerald-400" : "bg-gradient-to-t from-emerald-500 to-emerald-300"}`}
                      style={{ height: `${Math.max(4, ratio * 100)}%` }}
                    >
                      <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap group-hover:block">
                        {fmtPara(c.tutar)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs tabular-nums ${isToday ? "font-semibold text-emerald-700" : "text-slate-500"}`}>{c.gun}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Toplam</p>
              <p className="font-semibold tabular-nums text-slate-900">{fmtPara(haftalikCiro.reduce((s, c) => s + c.tutar, 0))}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ortalama</p>
              <p className="font-semibold tabular-nums text-slate-900">{fmtPara(Math.round(haftalikCiro.reduce((s, c) => s + c.tutar, 0) / 7))}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">En iyi gün</p>
              <p className="font-semibold tabular-nums text-emerald-700">{haftalikCiro.reduce((a, b) => (b.tutar > a.tutar ? b : a)).gun}</p>
            </div>
          </div>
        </div>

        {/* GECİKEN BAYİLER */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Geciken bayiler</h2>
              <p className="text-xs text-slate-500">2+ haftadır sipariş yok</p>
            </div>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-rose-50 px-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {gecikenBayiler.length}
            </span>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-slate-100">
            {gecikenBayiler.map((b) => (
              <div key={b.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.ad}</p>
                  <p className="text-xs text-slate-500">{b.sehir} · {b.yetkili}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium tabular-nums text-rose-600">{fmtTarihKisa(b.sonSiparis)}</p>
                  <button type="button" className="text-xs text-emerald-700 hover:underline">Mesaj at</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
            Hepsine hatırlatma gönder
          </button>
        </div>
      </section>

      {/* SON SİPARİŞLER TABLOSU */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Son siparişler</h2>
            <p className="text-xs text-slate-500">Son 24 saatte alınan 10 sipariş</p>
          </div>
          <Link href={`/${locale}/poc/v3-modern-dashboard/siparisler`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Tümünü gör →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-5 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Sipariş no</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Bayi</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tarih</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Kalem</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tutar</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sonSiparisler.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium tabular-nums text-slate-900">{s.siparisNo}</td>
                  <td className="px-3 py-3 text-slate-700">{s.bayiAd}</td>
                  <td className="px-3 py-3 text-slate-600 tabular-nums">{fmtTarihKisa(s.tarih)}</td>
                  <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{s.kalemSayisi}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{fmtPara(s.tutar)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${durumBg[s.durum]}`}>
                      {durumLabel[s.durum]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
