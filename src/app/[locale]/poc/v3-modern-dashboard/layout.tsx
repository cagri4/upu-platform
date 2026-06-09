import Link from "next/link";

// V3 — MODERN DASHBOARD
// Stripe / Banking inspired. Sidebar + top bar, koyu border'lar,
// kart-merkezli, dense, emerald accent.

export default async function V3Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* SIDEBAR (lg+) */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">U</span>
          <Link href={`/${locale}/poc`} className="text-sm font-semibold text-slate-900">UPU Dağıtıcı</Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Genel</p>
          <Link href={`/${locale}/poc/v3-modern-dashboard/dashboard`} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </Link>
          <Link href={`/${locale}/poc/v3-modern-dashboard/siparisler`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <span className="flex items-center gap-2.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Siparişler
            </span>
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">8</span>
          </Link>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Bayiler
          </span>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Ürünler
          </span>

          <p className="mt-4 px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Finans</p>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
            Faturalar
          </span>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Raporlar
          </span>
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-md bg-slate-50 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">MY</div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">Mehmet Yıldız</p>
              <p className="truncate text-xs text-slate-500">Gıda Toptan A.Ş.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* TOP BAR */}
      <div className="lg:ml-56">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          {/* Mobile logo */}
          <Link href={`/${locale}/poc`} className="flex items-center gap-2 lg:hidden">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">U</span>
            <span className="text-sm font-semibold">UPU Dağıtıcı</span>
          </Link>
          <div className="hidden lg:block">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="search" placeholder="Sipariş, bayi veya ürün ara..." className="h-9 w-80 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/poc`} className="hidden text-sm text-slate-500 hover:text-slate-900 md:inline">
              POC karşılaştırması
            </Link>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase ring-1 ring-emerald-200">
              POC V3
            </span>
            <button type="button" aria-label="Bildirimler" className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
            </button>
          </div>
        </header>

        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 sm:px-6">
          Mock veri — Faz 0.5 POC karşılaştırması. <Link href={`/${locale}/poc`} className="font-medium underline underline-offset-2 hover:text-amber-950">Diğer stilleri gör</Link>
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
