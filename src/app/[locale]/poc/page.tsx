import Link from "next/link";

const stiller = [
  {
    id: "v1-minimalism",
    ad: "V1 — Minimalism",
    kisaAd: "Linear / Vercel pattern",
    aciklama: "Beyaz boşluk öne, tek vurgu rengi (indigo), kart-az, tipografi ağırlıklı. Inline KPI, sade tablo. 'Less is more' — sessiz iş ortamı.",
    accent: "from-slate-50 to-white",
    border: "border-slate-200",
    badge: "bg-slate-900 text-white",
    preview: (
      <div className="flex h-full w-full flex-col gap-3 p-5">
        <div className="h-2 w-16 rounded-full bg-slate-900" />
        <div className="h-1.5 w-32 rounded-full bg-slate-200" />
        <div className="mt-2 flex gap-6">
          <div className="flex flex-col gap-1">
            <div className="h-1 w-8 rounded-full bg-slate-200" />
            <div className="h-3 w-12 rounded-full bg-slate-900" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-1 w-10 rounded-full bg-slate-200" />
            <div className="h-3 w-14 rounded-full bg-slate-900" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-1 w-8 rounded-full bg-slate-200" />
            <div className="h-3 w-10 rounded-full bg-slate-900" />
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="h-1 w-full rounded-full bg-slate-100" />
          <div className="h-1 w-full rounded-full bg-slate-100" />
          <div className="h-1 w-3/4 rounded-full bg-slate-100" />
        </div>
      </div>
    ),
  },
  {
    id: "v2-bento",
    ad: "V2 — Bento Grid",
    kisaAd: "Apple / Arc pattern",
    aciklama: "Modüler bloklar, farklı boyutlarda grid. Renkli vurgular, glassmorphism + soft gradient. Görsel zenginlik, blokların stagger animasyonu. Modern ve canlı.",
    accent: "from-indigo-50 via-rose-50 to-amber-50",
    border: "border-indigo-100",
    badge: "bg-gradient-to-r from-indigo-500 to-rose-500 text-white",
    preview: (
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-2 p-5">
        <div className="col-span-2 row-span-2 rounded-2xl bg-gradient-to-br from-indigo-200 via-indigo-100 to-white p-2">
          <div className="h-1.5 w-8 rounded-full bg-indigo-500" />
          <div className="mt-1.5 h-4 w-16 rounded-full bg-indigo-600" />
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-rose-200 to-rose-50 p-2">
          <div className="h-1 w-6 rounded-full bg-rose-500" />
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-200 to-amber-50 p-2">
          <div className="h-1 w-6 rounded-full bg-amber-500" />
        </div>
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-emerald-200 to-emerald-50 p-2">
          <div className="h-1 w-12 rounded-full bg-emerald-500" />
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-200 to-sky-50 p-2">
          <div className="h-1 w-6 rounded-full bg-sky-500" />
        </div>
      </div>
    ),
  },
  {
    id: "v3-modern-dashboard",
    ad: "V3 — Modern Dashboard",
    kisaAd: "Stripe / Banking inspired",
    aciklama: "Profesyonel, yoğun veri sunumu. Kart-merkezli, koyu border'lar, chart entegrasyonu. Tablo öne, soft pastel + tek accent (emerald). Banka panellerini andıran ciddiyet.",
    accent: "from-slate-50 to-emerald-50/30",
    border: "border-emerald-200",
    badge: "bg-emerald-600 text-white",
    preview: (
      <div className="flex h-full w-full flex-col gap-2 p-4">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-md border border-slate-200 bg-white p-1.5">
            <div className="h-1 w-4 rounded-full bg-slate-300" />
            <div className="mt-1 h-2 w-8 rounded-full bg-slate-700" />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-1.5">
            <div className="h-1 w-4 rounded-full bg-slate-300" />
            <div className="mt-1 h-2 w-8 rounded-full bg-emerald-600" />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-1.5">
            <div className="h-1 w-4 rounded-full bg-slate-300" />
            <div className="mt-1 h-2 w-7 rounded-full bg-slate-700" />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-1.5">
            <div className="h-1 w-4 rounded-full bg-slate-300" />
            <div className="mt-1 h-2 w-8 rounded-full bg-rose-500" />
          </div>
        </div>
        <div className="flex-1 rounded-md border border-slate-200 bg-white p-2">
          <div className="h-1 w-12 rounded-full bg-slate-300" />
          <div className="mt-2 flex h-10 items-end gap-1.5">
            <div className="h-3 w-2 rounded-sm bg-emerald-400" />
            <div className="h-5 w-2 rounded-sm bg-emerald-400" />
            <div className="h-4 w-2 rounded-sm bg-emerald-400" />
            <div className="h-7 w-2 rounded-sm bg-emerald-500" />
            <div className="h-6 w-2 rounded-sm bg-emerald-500" />
            <div className="h-9 w-2 rounded-sm bg-emerald-600" />
            <div className="h-8 w-2 rounded-sm bg-emerald-600" />
          </div>
        </div>
      </div>
    ),
  },
];

export default async function PocIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Uyarı */}
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <p className="font-medium">Bu sayfalardaki veriler canlı değildir.</p>
              <p className="mt-0.5 text-sm text-amber-800">Faz 0.5 tasarım dili karşılaştırması için mock data ile hazırlanmıştır. Hiçbir ücret, sipariş veya bayi gerçek değildir.</p>
            </div>
          </div>
        </div>

        {/* Başlık */}
        <header className="mb-10">
          <p className="text-sm font-medium text-indigo-600">Faz 0.5 — Tasarım Dili POC</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            3 stil, aynı veri. Hangisi UPU&apos;ya yakışır?
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600">
            Bayi dağıtıcı dashboard&apos;u ve siparişler sayfası, 3 farklı tasarım dilinde. Aynı mock data (10 bayi, 30 ürün, 50 sipariş) kullanılıyor — yalnız stil değişiyor. Karşılaştırın ve birini seçin; Faz 1&apos;deki tüm sayfalar bu dilde yazılacak.
          </p>
        </header>

        {/* 3 stil kartı */}
        <div className="grid gap-6 md:grid-cols-3">
          {stiller.map((s) => (
            <article key={s.id} className={`group flex flex-col overflow-hidden rounded-2xl border bg-white ${s.border} shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl`}>
              {/* Preview */}
              <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${s.accent}`}>
                {s.preview}
                <div className="absolute top-3 left-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>
                    {s.kisaAd}
                  </span>
                </div>
              </div>
              {/* Açıklama */}
              <div className="flex flex-1 flex-col gap-4 p-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{s.ad}</h2>
                <p className="text-sm leading-relaxed text-slate-600">{s.aciklama}</p>
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Link
                    href={`/${locale}/poc/${s.id}/dashboard`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Dashboard&apos;u Aç
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                  </Link>
                  <Link
                    href={`/${locale}/poc/${s.id}/siparisler`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Siparişler sayfası
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Alt bilgi */}
        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            Her POC bağımsız layout kullanır — mevcut bayipanel etkilenmez. Karar verildiğinde bu route&apos;lar silinip seçilen stil Faz 1&apos;e taşınır.
          </p>
        </footer>
      </div>
    </div>
  );
}
