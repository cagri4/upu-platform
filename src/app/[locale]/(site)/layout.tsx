"use client";

/**
 * Siteyönetim panel route group layout.
 * - /api/site/init ile token doğrulanır + displayName/buildingName fetch
 * - AdminLayout (sidebar + topbar) — siteyonetim sidebar items + sky accent
 * - Token yoksa/expired ise full-screen hata gösterilir
 *
 * Brief: Dashboard / Sakinler / Aidat / Şikayet/Talep / Etkinlik & Duyuru /
 * Personel / Profilim. Henüz dedicated CRUD sayfaları yok — her sidebar
 * item'ı /api/site/start magic-link mint endpoint'i üzerinden ilgili
 * WhatsApp komutuna veya genel profil sayfasına yönlendiriyor (geleceğe
 * bırakılan listeleme sayfaları için pattern hazır).
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout, type SidebarItem } from "@/components/admin-layout";

type InitState = "loading" | "ready" | "error";

const SITE_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard",        icon: "🏠", href: t => `/tr/site?t=${encodeURIComponent(t)}`,                                  matchPath: "/tr/site" },
  { id: "sakinler",  label: "Sakinler",         icon: "👥", href: t => `/tr/site-sakinlerim?t=${encodeURIComponent(t)}`, matchPath: "/tr/site-sakinlerim" },
  { id: "aidat",     label: "Aidat",            icon: "💰", href: t => `/api/panel/start?cmd=aidat&t=${encodeURIComponent(t)}` },
  { id: "talep",     label: "Şikayet/Talep",    icon: "🔧", href: t => `/api/panel/start?cmd=bakim&t=${encodeURIComponent(t)}` },
  { id: "duyuru",    label: "Etkinlik & Duyuru", icon: "📣", href: t => `/api/panel/start?cmd=duyuru&t=${encodeURIComponent(t)}` },
  { id: "personel",  label: "Personel",         icon: "🛠", href: t => `/api/panel/start?cmd=menu&t=${encodeURIComponent(t)}` },
  { id: "profil",    label: "Profilim",         icon: "⚙️",  href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`, matchPath: "/tr/profil-duzenle" },
];

export default function SitePanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState<string | null>(null);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/init${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setState("error"); setError(d.error); return; }
        setDisplayName(d.displayName ?? null);
        setBuildingName(d.buildingName ?? null);
        setState("ready");
      })
      .catch(() => { setState("error"); setError("Bağlantı hatası."); });
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
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={buildingName}
      sidebarItems={SITE_SIDEBAR_ITEMS}
      brandTitle="🏢 UPU Site"
      brandIconCollapsed="🏢"
      accentColor="cyan"
    >
      {children}
    </AdminLayout>
  );
}
