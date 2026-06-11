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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams, usePathname, useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { PanelAuthFail } from "@/components/panel-auth-fail";
import { Forbidden } from "@/components/banking";
import { HelpCenter } from "@/components/help/HelpCenter";
import { getBayiHelpDoc } from "@/content/help/bayi";
import {
  BAYI_SIDEBAR,
  BAYI_BRAND_TITLE,
  BAYI_BRAND_ICON,
  BAYI_ACCENT,
  BAYI_ROLE_REQUIREMENTS,
} from "@/tenants/bayi/components/sidebar";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

type InitState = "loading" | "ready" | "error";

export default function BayiPanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  // H-11 (2026-06-11 hardening): token'ı İLK render'da bir kez yakala (stable),
  // sonra URL'den temizle. Eski WA link'leri token'ı ?t= ile taşıyordu →
  // address-bar/history/log/referer sızıntısı. Cookie session'a geçildiği için
  // (init bir kez cookie attach eder) token URL'de kalmamalı. Capture stable
  // olduğundan init fetch kırılmaz.
  const [token] = useState<string | null>(
    () => searchParams.get("t") || searchParams.get("token"),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("t") || url.searchParams.has("token")) {
      url.searchParams.delete("t");
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);
  const pathname = usePathname() || "";
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const helpDoc = useMemo(() => getBayiHelpDoc(locale), [locale]);

  // Faz 2 cleanup (Sprint E): legacy panel flag default OFF → karma
  // (bayipanel) yerine V3 (bayi-portal)'a yönlendir. Flag true ise eski
  // davranış (admin debug için, env BAYI_LEGACY_PANEL=true ile açılır).
  const legacyEnabled = isBayiFeatureEnabled("bayi.legacy_panel");
  useEffect(() => {
    if (legacyEnabled) return;
    // /tr/bayi-panel ve alt sayfalardan /tr/bayi'ye redirect.
    // İlk açılışta tek seferlik replace — back butonu kullanıcıyı bayi'de tutar.
    router.replace(`/${locale}/bayi`);
  }, [legacyEnabled, locale, router]);

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [firmaUnvani, setFirmaUnvani] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  // Spinner flash önleme: 250ms'den hızlı fetch'lerde göstermez.
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSpinner(true), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apply = (d: { displayName?: string | null; firmaUnvani?: string | null; officeName?: string | null; role?: string | null }) => {
      if (cancelled) return;
      setDisplayName(d.displayName ?? null);
      setFirmaUnvani(d.firmaUnvani ?? d.officeName ?? null);
      setUserRole(d.role ?? null);
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
        {showSpinner && (
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin transition-opacity duration-300" />
        )}
      </div>
    );
  }

  if (state === "error") {
    return <PanelAuthFail tenantKey="bayi" message={error} />;
  }

  // Pathname-based rol check — locale prefix'i strip et ("/tr/bayi-x" → match).
  // BAYI_ROLE_REQUIREMENTS map'inde olmayan yol = public, herkes erişir.
  const normalizedPath = pathname.replace(/^\/(tr|en|nl)/, "/tr").replace(/\?.*$/, "");
  const requiredRoles = (BAYI_ROLE_REQUIREMENTS as Record<string, readonly string[]>)[normalizedPath];
  const blocked = requiredRoles && requiredRoles.length > 0 &&
    (!userRole || !requiredRoles.includes(userRole));

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={firmaUnvani}
      sidebarItems={BAYI_SIDEBAR}
      userRole={userRole}
      brandTitle={BAYI_BRAND_TITLE}
      brandIconCollapsed={BAYI_BRAND_ICON}
      accentColor={BAYI_ACCENT}
      tenantKey="bayi"
      notificationHistoryHref="/tr/bayi-bildirimler"
    >
      {blocked ? (
        <Forbidden
          message={`Bu sayfa için yetkiniz yok. Gerekli rol: ${requiredRoles.join(" / ")}. Yöneticinizden yetki talep edebilirsiniz.`}
        />
      ) : (
        children
      )}
      <HelpCenter saasKey="bayi" content={helpDoc} />
    </AdminLayout>
  );
}
