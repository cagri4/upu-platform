import Link from "next/link";

// V1 — MINIMALISM
// Linear / Vercel pattern. Sade beyaz, ince border, indigo accent,
// tipografi öne, kart-az, çok beyaz boşluk.

export default async function V1Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      {/* TOP NAV — sade, sadece logo + 2 link + kullanıcı */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href={`/${locale}/poc`} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" />
              UPU
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-600 uppercase">POC V1</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link href={`/${locale}/poc/v1-minimalism/dashboard`} className="rounded-md px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href={`/${locale}/poc/v1-minimalism/siparisler`} className="rounded-md px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900">
                Siparişler
              </Link>
              <span className="rounded-md px-3 py-1.5 text-sm text-slate-400">Bayiler</span>
              <span className="rounded-md px-3 py-1.5 text-sm text-slate-400">Ürünler</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/poc`} className="hidden text-sm text-slate-500 hover:text-slate-900 md:inline">
              POC karşılaştırması
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
              MY
            </div>
          </div>
        </div>
      </header>

      {/* ÜST UYARI (POC) — kırmızı band */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 sm:px-6">
        Mock veri — Faz 0.5 POC karşılaştırması. <Link href={`/${locale}/poc`} className="underline underline-offset-2 hover:text-amber-950">Diğer stilleri gör</Link>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
