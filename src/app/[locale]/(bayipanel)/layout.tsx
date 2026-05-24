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
import { useSearchParams, usePathname } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { PanelAuthFail } from "@/components/panel-auth-fail";
import { Forbidden } from "@/components/banking";
import { UpuAgentWidget } from "@/components/agent/UpuAgentWidget";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { BAYI_ONBOARDING } from "@/tenants/bayi/onboarding-config";
import {
  BAYI_SIDEBAR,
  BAYI_BRAND_TITLE,
  BAYI_BRAND_ICON,
  BAYI_ACCENT,
  BAYI_ROLE_REQUIREMENTS,
} from "@/tenants/bayi/components/sidebar";

type InitState = "loading" | "ready" | "error";

export default function BayiPanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const pathname = usePathname() || "";

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [firmaUnvani, setFirmaUnvani] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardInitialState, setWizardInitialState] = useState<Record<string, unknown>>({});
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

  // Onboarding state — auth ready olduktan + admin/owner rolündeyse
  useEffect(() => {
    if (state !== "ready") return;
    if (userRole && userRole !== "admin" && userRole !== "user") return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/bayi-onboarding/state", { credentials: "same-origin" });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        if (!d?.completed) {
          setWizardStep(Math.max(0, Math.min(BAYI_ONBOARDING.totalSteps - 1, d.step || 0)));
          setWizardInitialState(d.initial_state || {});
          setShowWizard(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [state, userRole]);

  // Sidebar "Sistem Turu" linki query ile tetikler: ?onboarding=1
  useEffect(() => {
    if (state !== "ready") return;
    if (searchParams.get("onboarding") === "1") {
      setWizardStep(0);
      setShowWizard(true);
    }
  }, [state, searchParams]);

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
      <UpuAgentWidget />
      {showWizard && (
        <OnboardingWizard
          config={BAYI_ONBOARDING}
          initialStep={wizardStep}
          initialState={{ ...wizardInitialState, displayName, firmaUnvani }}
          onClose={() => setShowWizard(false)}
          onCompleted={() => setShowWizard(false)}
        />
      )}
    </AdminLayout>
  );
}
