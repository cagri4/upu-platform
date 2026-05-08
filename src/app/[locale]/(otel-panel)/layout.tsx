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

type InitState = "loading" | "ready" | "error";

const OTEL_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "dashboard",     label: "Dashboard",          icon: "🏠", href: t => `/tr/otel-panel?t=${encodeURIComponent(t)}`,           matchPath: "/tr/otel-panel" },
  { id: "rezervasyon",   label: "Rezervasyonlar",     icon: "📅", href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`,  matchPath: "/tr/otel-rezervasyonlar" },
  { id: "konuklar",      label: "Müşteriler",         icon: "👥", href: t => `/tr/otel-konuklar?t=${encodeURIComponent(t)}`,        matchPath: "/tr/otel-konuklar" },
  { id: "takvim",        label: "Müsaitlik Takvimi",  icon: "🗓",  href: t => `/tr/otel-takvim?t=${encodeURIComponent(t)}`,          matchPath: "/tr/otel-takvim" },
  { id: "odalar",        label: "Odalar",             icon: "🚪", href: t => `/tr/otel-odalar?t=${encodeURIComponent(t)}`,          matchPath: "/tr/otel-odalar" },
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
    if (!token) { setState("error"); setError("Link geçersiz."); return; }
    fetch(`/api/otel-panel/init?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setState("error"); setError(d.error); return; }
        setDisplayName(d.displayName ?? null);
        setOfficeName(d.officeName ?? null);
        setState("ready");
      })
      .catch(() => { setState("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-4xl">⏳</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Hata</h1>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <a
            href="https://wa.me/31644967207"
            className="inline-block bg-rose-600 text-white px-6 py-3 rounded-lg"
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
      officeName={officeName}
      sidebarItems={OTEL_SIDEBAR_ITEMS}
      brandTitle="🏨 UPU Otel"
      brandIconCollapsed="🏨"
      accentColor="rose"
    >
      {children}
    </AdminLayout>
  );
}
