"use client";

/**
 * Bayi yönetim paneli route group layout.
 *
 * Emlak (panel) layout pattern'inin bayi kardeşi. İzole namespace —
 * `(bayipanel)` route group emlak `(panel)` ile çakışmaz, paralel
 * tmux çalışmasında bayi sayfaları kendi içinde kapalı.
 *
 * - /api/bayi-panel/init ile token doğrulanır + displayName/firmaUnvani fetch
 * - AdminLayout (sidebar + topbar) sarımı uygulanır — bayi sidebar
 *   config + indigo accent
 * - Token yoksa/expired ise full-screen hata, child sayfa render edilmez
 *
 * Form sayfaları (bayi-profil, bayi-baglanti, bayi-urun-ekle vb.) bu
 * group DIŞINDA kalır — WA WebView'da full-screen pattern korunur.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { PanelAuthFail } from "@/components/panel-auth-fail";
import { BAYI_SIDEBAR, BAYI_BRAND_TITLE, BAYI_BRAND_ICON, BAYI_ACCENT } from "@/tenants/bayi/components/sidebar";

type InitState = "loading" | "ready" | "error";

export default function BayiPanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [firmaUnvani, setFirmaUnvani] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (d: { displayName?: string | null; firmaUnvani?: string | null; officeName?: string | null }) => {
      if (cancelled) return;
      setDisplayName(d.displayName ?? null);
      setFirmaUnvani(d.firmaUnvani ?? d.officeName ?? null);
      setState("ready");
    };
    const fail = (msg: string) => {
      if (cancelled) return;
      setState("error");
      setError(msg);
    };

    (async () => {
      try {
        const meRes = await fetch("/api/bayi-panel/me", { credentials: "same-origin" });
        if (meRes.ok) {
          const d = await meRes.json();
          if (d?.success) return apply(d);
        }
        if (!token) {
          return fail("Oturum bulunamadı veya süresi dolmuş.");
        }
        const initRes = await fetch(`/api/bayi-panel/init?t=${encodeURIComponent(token)}`, {
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
    return <PanelAuthFail tenantKey="bayi" message={error} />;
  }

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={firmaUnvani}
      sidebarItems={BAYI_SIDEBAR}
      brandTitle={BAYI_BRAND_TITLE}
      brandIconCollapsed={BAYI_BRAND_ICON}
      accentColor={BAYI_ACCENT}
      tenantKey="bayi"
    >
      {children}
    </AdminLayout>
  );
}
