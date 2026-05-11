"use client";

/**
 * Market yönetim paneli route group layout.
 *
 * Emlak (panel) layout pattern'inin market kardeşi. İzole namespace —
 * `(market-panel)` route group emlak `(panel)` ile çakışmaz, paralel
 * tmux çalışmasında market sayfaları kendi içinde kapalı.
 *
 * - /api/market/init ile token doğrulanır + displayName/storeName fetch
 * - AdminLayout (sidebar + topbar) sarımı uygulanır — market sidebar
 *   config + amber accent
 * - Token yoksa/expired ise full-screen hata, child sayfa render edilmez
 *
 * Form sayfaları (market-profilim) bu group DIŞINDA kalır — WA WebView'da
 * full-screen pattern korunur.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout, type SidebarItem } from "@/components/admin-layout";

type InitState = "loading" | "ready" | "error";

const MARKET_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "panelim",     label: "Panelim",                icon: "🏠", href: t => `/tr/market-panelim?t=${encodeURIComponent(t)}`,             matchPath: "/tr/market-panelim" },
  { id: "stok",        label: "Stok",                   icon: "📦", href: t => `/tr/market-stok?t=${encodeURIComponent(t)}`,                matchPath: "/tr/market-stok" },
  { id: "tedarikciler",label: "Tedarikçiler",           icon: "🚚", href: t => `/tr/market-tedarikciler?t=${encodeURIComponent(t)}`,        matchPath: "/tr/market-tedarikciler" },
  { id: "tsiparis",    label: "Tedarikçi Siparişleri",  icon: "📥", href: t => `/tr/market-tedarikci-siparisleri?t=${encodeURIComponent(t)}`, matchPath: "/tr/market-tedarikci-siparisleri" },
  { id: "sadakat",     label: "Müşteri Sadakati",       icon: "💛", href: t => `/tr/market-musteri-sadakati?t=${encodeURIComponent(t)}`,    matchPath: "/tr/market-musteri-sadakati" },
  { id: "kasa",        label: "Kasa Raporu",            icon: "🧾", href: t => `/tr/market-kasa-raporu?t=${encodeURIComponent(t)}`,         matchPath: "/tr/market-kasa-raporu" },
  { id: "profil",      label: "Profilim",               icon: "👤", href: t => `/tr/market-profilim?t=${encodeURIComponent(t)}`,           matchPath: "/tr/market-profilim" },
  { id: "hakkinda",    label: "UPUDev Hakkında",        icon: "ℹ️",  href: t => `/tr/market-hakkinda?t=${encodeURIComponent(t)}`,            matchPath: "/tr/market-hakkinda", separatorBefore: true },
  { id: "oneri",       label: "Öneri / Şikayet",        icon: "💬", href: t => `/tr/market-oneri?t=${encodeURIComponent(t)}`,               matchPath: "/tr/market-oneri" },
  { id: "destek",      label: "Destek Talebi",          icon: "🛟", href: t => `/tr/market-destek?t=${encodeURIComponent(t)}`,             matchPath: "/tr/market-destek" },
];

export default function MarketPanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (d: { displayName?: string | null; officeName?: string | null }) => {
      if (cancelled) return;
      setDisplayName(d.displayName ?? null);
      setStoreName(d.officeName ?? null);
      setState("ready");
    };
    const fail = (msg: string) => {
      if (cancelled) return;
      setState("error");
      setError(msg);
    };

    (async () => {
      try {
        const meRes = await fetch("/api/market/me", { credentials: "same-origin" });
        if (meRes.ok) {
          const d = await meRes.json();
          if (d?.success) return apply(d);
        }
        if (!token) {
          return fail("Oturum bulunamadı veya süresi dolmuş.");
        }
        const initRes = await fetch(`/api/market/init?t=${encodeURIComponent(token)}`, {
          credentials: "same-origin",
        });
        const d = await initRes.json();
        if (d?.error) return fail(d.error);
        apply(d);
      } catch {
        fail("Bağlantı hatası.");
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-4xl">⏳</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Hata</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
          <a
            href="https://wa.me/31644967207"
            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            WhatsApp&apos;a dön
          </a>
          <p className="text-slate-500 text-xs mt-4 leading-relaxed">
            💡 WhatsApp&apos;a döndükten sonra son gönderdiğim &quot;Panele Git&quot; butonuna tekrar dokunarak yeni bir bağlantı alabilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={storeName}
      sidebarItems={MARKET_SIDEBAR_ITEMS}
      brandTitle="🛒 UPU Market"
      brandIconCollapsed="🛒"
      accentColor="amber"
      tenantKey="market"
    >
      {children}
    </AdminLayout>
  );
}
