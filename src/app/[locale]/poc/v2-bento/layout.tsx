import Link from "next/link";

// V2 — BENTO GRID
// Apple / Arc / yeni Shadcn pattern. Modüler renkli bloklar, glassmorphism,
// gradient'ler, görsel zenginlik. Tipografi: kalın başlık + sade gövde.

export default async function V2Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-sans text-slate-900 antialiased">
      {/* TOP NAV — sticky, blur, renkli logo */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href={`/${locale}/poc`} className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
              <span className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 text-xs font-bold text-white shadow-md shadow-indigo-500/30">
                U
              </span>
              UPU
              <span className="rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">POC V2</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link href={`/${locale}/poc/v2-bento/dashboard`} className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-white hover:shadow-sm">
                Dashboard
              </Link>
              <Link href={`/${locale}/poc/v2-bento/siparisler`} className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-white hover:shadow-sm">
                Siparişler
              </Link>
              <span className="rounded-full px-4 py-1.5 text-sm text-slate-400">Bayiler</span>
              <span className="rounded-full px-4 py-1.5 text-sm text-slate-400">Ürünler</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/poc`} className="hidden text-sm text-slate-500 hover:text-slate-900 md:inline">
              POC karşılaştırması
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-semibold text-white shadow-md shadow-indigo-500/30">
              MY
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 sm:px-6">
        Mock veri — Faz 0.5 POC karşılaştırması. <Link href={`/${locale}/poc`} className="font-semibold underline underline-offset-2 hover:text-amber-950">Diğer stilleri gör</Link>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
