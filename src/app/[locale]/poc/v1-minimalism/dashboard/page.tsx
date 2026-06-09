import Link from "next/link";
import {
  kpi,
  sonSiparisler,
  gecikenBayiler,
  fmtPara,
  fmtTarihKisa,
  durumLabel,
} from "../../mock-data";

// V1 Minimalism — Dashboard
// "Less is more". KPI'lar inline metin olarak. Sade tablo. Minimum gölge.

const durumRenk: Record<string, string> = {
  beklemede: "text-amber-700",
  onaylandi: "text-indigo-700",
  hazirlaniyor: "text-sky-700",
  yolda: "text-cyan-700",
  teslim: "text-emerald-700",
  iptal: "text-rose-700",
};

export default async function V1Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <div className="flex flex-col gap-12">
      {/* HEADER — büyük başlık, sade, tipografi öne */}
      <section>
        <p className="text-sm text-slate-500">Pazartesi, 9 Haziran 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Hoşgeldin, Mehmet Bey
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Gıda toptancısı kontrol paneli. Bugünkü hareket aşağıda — geciken bayiler bekliyor.
        </p>
      </section>

      {/* KPI — KART DEĞİL, INLINE METRİC. Minimalism ayrım noktası. */}
      <section>
        <dl className="grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:gap-x-8">
          <div className="flex flex-col gap-1 border-l-2 border-slate-200 pl-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Bugünkü sipariş</dt>
            <dd className="text-3xl font-semibold tracking-tight text-slate-900">{kpi.bugunkuSiparis}</dd>
            <p className="text-xs text-slate-500">son sipariş 14 dakika önce</p>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-indigo-600 pl-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Bugünkü ciro</dt>
            <dd className="text-3xl font-semibold tracking-tight text-slate-900">{fmtPara(kpi.bugunkuCiro)}</dd>
            <p className="text-xs text-indigo-600">+18% (dün)</p>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-amber-500 pl-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Bekleyen onay</dt>
            <dd className="text-3xl font-semibold tracking-tight text-slate-900">{kpi.bekleyenOnay}</dd>
            <p className="text-xs text-slate-500">en eski 4 saat önce</p>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-rose-500 pl-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Geciken bayi</dt>
            <dd className="text-3xl font-semibold tracking-tight text-slate-900">{kpi.gecikenBayi}</dd>
            <p className="text-xs text-rose-600">aksiyon gerek</p>
          </div>
        </dl>
      </section>

      {/* İKİ KOLON: SON SİPARİŞLER (sol) + GECİKEN BAYİLER (sağ) */}
      <div className="grid gap-10 lg:grid-cols-3">
        {/* SOL: Son siparişler tablosu — sade satırlar, gölge yok */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Son siparişler</h2>
              <p className="text-sm text-slate-500">Son 24 saatte alınan 10 sipariş</p>
            </div>
            <Link
              href={`/${locale}/poc/v1-minimalism/siparisler`}
              className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Tümünü gör →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 pr-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Bayi</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase">Tutar</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Tarih</th>
                  <th className="py-2.5 pl-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sonSiparisler.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900">{s.bayiAd}</div>
                      <div className="text-xs text-slate-500">{s.siparisNo} · {s.kalemSayisi} kalem</div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{fmtPara(s.tutar)}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtTarihKisa(s.tarih)}</td>
                    <td className={`py-3 pl-3 font-medium ${durumRenk[s.durum]}`}>{durumLabel[s.durum]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SAĞ: Geciken bayiler widget + hızlı aksiyon */}
        <aside className="flex flex-col gap-8">
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Bu hafta gecikenler</h2>
              <p className="text-sm text-slate-500">2 haftadır sipariş vermedi</p>
            </div>
            <ul className="flex flex-col gap-3">
              {gecikenBayiler.map((b) => (
                <li key={b.id} className="border-l-2 border-rose-300 py-1 pl-3">
                  <p className="font-medium text-slate-900">{b.ad}</p>
                  <p className="text-xs text-slate-500">{b.sehir} · {b.yetkili}</p>
                  <p className="mt-0.5 text-xs text-rose-600">Son sipariş: {fmtTarihKisa(b.sonSiparis)}</p>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Hatırlatma gönder →
            </button>
          </section>

          {/* Hızlı aksiyonlar — düz link liste, kart değil */}
          <section>
            <h2 className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">Hızlı aksiyon</h2>
            <div className="flex flex-col">
              <button type="button" className="border-b border-slate-100 py-3 text-left text-sm text-slate-700 transition-colors hover:text-indigo-700">
                + Yeni kampanya başlat
              </button>
              <button type="button" className="border-b border-slate-100 py-3 text-left text-sm text-slate-700 transition-colors hover:text-indigo-700">
                {kpi.bekleyenOnay} bekleyen siparişi onayla
              </button>
              <button type="button" className="border-b border-slate-100 py-3 text-left text-sm text-slate-700 transition-colors hover:text-indigo-700">
                Yeni bayi davet et
              </button>
              <button type="button" className="py-3 text-left text-sm text-slate-700 transition-colors hover:text-indigo-700">
                Stok girişi yap
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
