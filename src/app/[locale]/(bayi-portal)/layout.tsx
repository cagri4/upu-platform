"use client";

/**
 * Bayi (alıcı) portalı route group layout — Faz 2.
 *
 * V3 Modern Dashboard pattern'iyle Ayşe Hanım (market sahibi) görünümü.
 * Mevcut `(bayipanel)` route group'undan AYRI — orası dağıtıcı+alıcı
 * karma sayfalar barındırıyor. Bu yeni group sadece alıcı görünümünü
 * V3 dilinde tutar.
 *
 * URL: /<locale>/bayi/* (örn. /tr/bayi, /tr/bayi/katalog).
 *
 * Auth: cookie session. /api/bayi/me ile rol + display name çekilir.
 * Layout child sayfalarına context'i veri çağırarak değil; her sayfa
 * kendi API'sini çeker. Burada sadece shell sarımı yapılır.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/admin/v3-shell";
import { PanelAuthFail } from "@/components/panel-auth-fail";
import { buyerNavSections } from "@/components/buyer/bayi-nav-config";

type State = "loading" | "ready" | "error";

export default function BayiPortalLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bayi/me", { credentials: "same-origin" });
        if (!res.ok) {
          if (cancelled) return;
          setState("error");
          setError("Oturum bulunamadı veya süresi dolmuş.");
          return;
        }
        const d = await res.json();
        if (cancelled) return;
        if (!d.success) {
          setState("error");
          setError(d.error || "Yetki doğrulanamadı.");
          return;
        }
        setDisplayName(d.displayName || null);
        setTenantName(d.tenant?.name || "Bayi");
        setState("ready");
      } catch {
        if (cancelled) return;
        setState("error");
        setError("Bağlantı hatası.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  if (state === "error") {
    return <PanelAuthFail tenantKey="bayi" message={error} />;
  }

  return (
    <AppShell
      locale={locale}
      tenantName={tenantName || "Bayi"}
      userName={displayName || "Kullanıcı"}
      navSections={buyerNavSections(locale)}
      brandTitle="UPU Bayi"
      brandLetter="B"
      accent="indigo"
    >
      {children}
    </AppShell>
  );
}
