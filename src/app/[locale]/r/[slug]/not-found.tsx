import Link from "next/link";

export default function RestaurantNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-8 text-center">
        <div className="text-6xl mb-4">🍽</div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Restoran bulunamadı
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          Aradığınız restoran sayfası yayında değil veya kapatılmış. Adresi
          kontrol edip tekrar deneyin.
        </p>
        <Link
          href="/"
          className="inline-flex items-center bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
