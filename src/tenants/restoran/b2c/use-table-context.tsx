"use client";

/**
 * useTableContext hook — QR'dan gelen müşterinin masa context'i.
 *
 * Kaynak öncelik:
 *   1. URL ?table={qr_token} (URL paramı backup)
 *   2. localStorage `restoran-table-{slug}`
 *
 * URL paramı varsa localStorage'a senkronize edilir (deep-link senaryosu).
 * SSR-safe: ilk render null döner, useEffect ile hydrate.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getTableContext,
  setTableContext,
  type TableContext,
} from "./table-context";

export interface UseTableContextResult {
  tableContext: TableContext | null;
  hydrated: boolean;
}

export function useTableContext(
  slug: string,
  fallbackTable?: { tableId: string; qrToken: string; tableLabel: string; capacity: number | null; zone: string | null } | null,
): UseTableContextResult {
  const searchParams = useSearchParams();
  const urlTableToken = searchParams?.get("table") || null;
  const [tableContext, setLocalContext] = useState<TableContext | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // 1. localStorage öncelikli (TTL check içinde)
    const stored = getTableContext(slug);
    if (stored) {
      setLocalContext(stored);
      setHydrated(true);
      return;
    }

    // 2. URL paramı varsa fallback context'ten yaz
    if (urlTableToken && fallbackTable && fallbackTable.qrToken === urlTableToken) {
      setTableContext(slug, fallbackTable);
      const fresh = getTableContext(slug);
      setLocalContext(fresh);
      setHydrated(true);
      return;
    }

    setHydrated(true);
  }, [slug, urlTableToken, fallbackTable]);

  return { tableContext, hydrated };
}
