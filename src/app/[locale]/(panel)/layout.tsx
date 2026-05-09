"use client";

/**
 * Emlak yönetim paneli route group layout.
 *
 * Auth akışı (cookie öncelikli):
 *   1) /api/panel/me — cookie session geçerse direkt ready (URL'de token gerekmez)
 *   2) Cookie yoksa/geçersizse + URL'de t=... varsa → /api/panel/init ile token doğrula + cookie set
 *   3) İkisi de yoksa hata göster
 *
 * Form sayfaları (mulkekle-form, profil-duzenle, musteri-ekle-form) bu group DIŞINDA
 * kalır — WA WebView'da full-screen pattern korunur.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout, type SidebarItem } from "@/components/admin-layout";

const EMLAK_BOTTOM_TABS: SidebarItem[] = [
  { id: "panelim",    label: "Panelim",       icon: "🏠", href: t => `/tr/panel?t=${encodeURIComponent(t)}`,         matchPath: "/tr/panel" },
  { id: "mulkler",    label: "Mülkler",       icon: "🏢", href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}`,     matchPath: "/tr/mulklerim" },
  { id: "musteriler", label: "Müşteriler",    icon: "👥", href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}`,  matchPath: "/tr/musterilerim" },
  { id: "sozlesme",   label: "Sözleşmeler",   icon: "📋", href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}`, matchPath: "/tr/sozlesmelerim" },
];

type InitState = "loading" | "ready" | "error";

export default function PanelGroupLayout({ children }: { children: ReactNode }) {
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
        const meRes = await fetch("/api/panel/me", { credentials: "same-origin" });
        if (meRes.ok) {
          const d = await meRes.json();
          if (d?.success) return apply(d);
        }
        if (!token) {
          return fail("Oturum bulunamadı veya süresi dolmuş.");
        }
        const initRes = await fetch(`/api/panel/init?t=${encodeURIComponent(token)}`, {
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
      officeName={officeName}
      tenantKey="emlak"
      bottomTabs={EMLAK_BOTTOM_TABS}
    >
      {children}
    </AdminLayout>
  );
}
