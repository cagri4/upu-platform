"use client";

/**
 * Client-side QR entry handler.
 *
 * Davranış:
 *   1. localStorage'a masa context yaz
 *   2. 800ms hoş geldin animasyonu göster
 *   3. /menu?table={qr_token}'a yönlendir (URL param backup, localStorage clear olursa)
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Users } from "lucide-react";
import { setTableContext, type TableContext } from "./table-context";

export function TableEntryClient({
  locale,
  slug,
  brandName,
  primaryColor,
  tableContext,
}: {
  locale: string;
  slug: string;
  brandName: string;
  primaryColor: string;
  tableContext: Omit<TableContext, "enteredAt">;
}) {
  const router = useRouter();

  useEffect(() => {
    // Masa context'i localStorage'a yaz
    setTableContext(slug, tableContext);
    // 800ms sonra menüye redirect (URL'de table param ile fallback)
    const timer = setTimeout(() => {
      router.replace(`/${locale}/r/${slug}/menu?table=${tableContext.qrToken}`);
    }, 800);
    return () => clearTimeout(timer);
  }, [router, locale, slug, tableContext]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div
          className="w-20 h-20 mx-auto rounded-3xl text-white flex items-center justify-center shadow-lg mb-5 animate-bounce"
          style={{ backgroundColor: primaryColor }}
        >
          <UtensilsCrossed className="w-10 h-10" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          {brandName}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
          Hoş geldiniz! Menü hazırlanıyor…
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-sm font-medium">
          <Users className="w-3.5 h-3.5" strokeWidth={2.4} />
          Masa {tableContext.tableLabel}
          {tableContext.capacity ? ` · ${tableContext.capacity} kişilik` : ""}
        </div>
      </div>
    </main>
  );
}
