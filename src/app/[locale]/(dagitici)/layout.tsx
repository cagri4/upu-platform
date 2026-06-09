"use client";

/**
 * Dağıtıcı paneli route group layout.
 *
 * B2B Portal MVP Faz 1.1 — bayi tenant'ın admin/satis kullanıcısı (dağıtıcı,
 * Mehmet Bey) için ayrı panel. (bayipanel) route group ile farklı bir yüz.
 *
 * Auth akışı: /api/bayi-panel/me cookie session'ı doğruluyor; rol guard
 * (admin/satis) sayfada uygulanıyor. Diğer roller (depocu/muhasebe) shell'i
 * görür ama "yetkiniz yok" mesajı gösterilebilir — şu an hepsi 403 dönmüyor,
 * sayfaya gelmiş kullanıcı kendi sayfasındaki yetkiyi görür.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/admin/v3-shell";
import { PanelAuthFail } from "@/components/panel-auth-fail";

type State = "loading" | "ready" | "error";

export default function DagiticiLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bayi-panel/me", { credentials: "same-origin" });
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
        setTenantName(d.firmaUnvani || d.officeName || "Dağıtıcı");
        setRole(d.role || null);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (state === "error") {
    return <PanelAuthFail tenantKey="bayi" message={error} />;
  }

  const isAuthorized = role === "admin" || role === "satis";
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900">
            Bu alana erişiminiz yok
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Dağıtıcı paneli yalnız admin veya satış rolü için açıktır. Mevcut
            rolünüz: {role || "tanımsız"}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      locale={locale}
      tenantName={tenantName || "Dağıtıcı"}
      userName={displayName || "Kullanıcı"}
    >
      {children}
    </AppShell>
  );
}
