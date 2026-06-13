"use client";

/**
 * Otel yönetim paneli route group layout.
 * - /api/otel-panel/init ile token doğrulanır + displayName/officeName fetch
 * - AdminLayout (sidebar + topbar) sarımı uygulanır — otel sidebar config
 * - Token yoksa/expired ise full-screen hata, child sayfa render edilmez
 *
 * Form sayfaları (otel-cekin, otel-calisan-davet) bu group DIŞINDA — WA
 * mekik linklerinden açılır, full-screen pattern korunur.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout, type SidebarItem } from "@/components/admin-layout";
import { PanelAuthFail } from "@/components/panel-auth-fail";

type InitState = "loading" | "ready" | "error";

const OTEL_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "dashboard",     label: "Dashboard",          icon: "🏠", href: t => `/tr/otel-panel?t=${encodeURIComponent(t)}`,           matchPath: "/tr/otel-panel" },
  { id: "rezervasyon",   label: "Rezervasyonlar",     icon: "📅", href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`,  matchPath: "/tr/otel-rezervasyonlar" },
  { id: "konuklar",      label: "Müşteriler",         icon: "👥", href: t => `/tr/otel-konuklar?t=${encodeURIComponent(t)}`,        matchPath: "/tr/otel-konuklar" },
  { id: "takvim",        label: "Müsaitlik Takvimi",  icon: "🗓",  href: t => `/tr/otel-takvim?t=${encodeURIComponent(t)}`,          matchPath: "/tr/otel-takvim" },
  { id: "odalar",        label: "Odalar",             icon: "🚪", href: t => `/tr/otel-odalar?t=${encodeURIComponent(t)}`,          matchPath: "/tr/otel-odalar" },
  { id: "housekeeping",  label: "Kat Hizmetleri",     icon: "🧹", href: t => `/tr/otel-housekeeping?t=${encodeURIComponent(t)}`,    matchPath: "/tr/otel-housekeeping" },
  { id: "fiyat",         label: "Fiyat Takvimi",      icon: "💲", href: t => `/tr/otel-fiyat?t=${encodeURIComponent(t)}`,           matchPath: "/tr/otel-fiyat" },
  { id: "gelir",         label: "Gelir Raporu",       icon: "📊", href: t => `/tr/otel-gelir?t=${encodeURIComponent(t)}`,           matchPath: "/tr/otel-gelir" },
  { id: "website",       label: "Web Sitesi",         icon: "🌐", href: t => `/tr/otel-website?t=${encodeURIComponent(t)}`,         matchPath: "/tr/otel-website" },
  { id: "kbs",           label: "KBS Bildirim",       icon: "🛡️", href: t => `/tr/otel-kbs?t=${encodeURIComponent(t)}`,             matchPath: "/tr/otel-kbs" },
  { id: "odemeler",      label: "Ödemeler",           icon: "💰", href: t => `/tr/otel-odemeler?t=${encodeURIComponent(t)}`,        matchPath: "/tr/otel-odemeler" },
  { id: "mesaj-taslak",  label: "Mesaj Taslakları",   icon: "✉️",  href: t => `/tr/otel-mesajlar?t=${encodeURIComponent(t)}`,        matchPath: "/tr/otel-mesajlar" },
  { id: "profil",        label: "Profilim",           icon: "⚙️",  href: t => `/tr/otel-profil?t=${encodeURIComponent(t)}`,          matchPath: "/tr/otel-profil" },
];

export default function OtelPanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (d: { displayName?: string | null; officeName?: string | null }) => {
      if (cancelled) return;
      setDisplayName(d.displayName ?? null);
      setOfficeName(d.officeName ?? null);
      setState("ready");
    };
    const fail = (msg: string) => {
      if (cancelled) return;
      setState("error");
      setError(msg);
    };

    (async () => {
      try {
        const meRes = await fetch("/api/otel-panel/me", { credentials: "same-origin" });
        if (meRes.ok) {
          const d = await meRes.json();
          if (d?.success) return apply(d);
        }
        if (!token) {
          return fail("Oturum bulunamadı veya süresi dolmuş.");
        }
        const initRes = await fetch(`/api/otel-panel/init?t=${encodeURIComponent(token)}`, {
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
    return <PanelAuthFail tenantKey="otel" message={error} />;
  }

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={officeName}
      sidebarItems={OTEL_SIDEBAR_ITEMS}
      brandTitle="🏨 UPU Otel"
      brandIconCollapsed="🏨"
      accentColor="rose"
      tenantKey="otel"
    >
      {children}
    </AdminLayout>
  );
}
