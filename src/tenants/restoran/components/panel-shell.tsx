"use client";

/**
 * RestoranPanelShell — her panel sayfasının ortak sarmalayıcısı.
 *
 * Akış:
 *   1. URL'den token (?t=) oku
 *   2. /api/restoran-panel/init ile doğrula
 *   3. Loading / error / ready durumlarını yönet
 *   4. ready'de AdminLayout (restoran sidebar + brand + accent) ile children sar
 *
 * Her panel sayfası bu shell'i kullanır:
 *   <RestoranPanelShell>
 *     <DashboardContent />
 *   </RestoranPanelShell>
 *
 * children render callback alır (token + restaurantName) — sayfa kendi
 * data fetch'ini token ile yapar.
 */

import { useEffect, useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { RESTORAN_SIDEBAR, RESTORAN_BRAND_TITLE, RESTORAN_BRAND_ICON, RESTORAN_ACCENT } from "./sidebar";

interface InitData {
  displayName: string | null;
  restaurantName: string | null;
  location: string | null;
}

type Status = "loading" | "ready" | "error";

export function RestoranPanelShell({
  children,
}: {
  children: (ctx: { token: string; init: InitData }) => ReactNode;
}) {
  const searchParams = useSearchParams();
  const token = searchParams?.get("t") || searchParams?.get("token") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [init, setInit] = useState<InitData>({ displayName: null, restaurantName: null, location: null });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Link eksik. WhatsApp'tan 'panel' yazıp yeni link alın.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/init?t=${token}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setStatus("error");
          setErrorMsg(json.error || "Link doğrulanamadı.");
          return;
        }
        setInit({
          displayName: json.displayName,
          restaurantName: json.restaurantName,
          location: json.location,
        });
        setStatus("ready");
      } catch {
        setStatus("error");
        setErrorMsg("Bağlantı hatası.");
      }
    })();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Yükleniyor…</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Bir sorun var</h1>
          <p className="text-slate-600 mb-4">{errorMsg}</p>
          <a
            href="https://wa.me/31644967207?text=panel"
            className="inline-block bg-amber-600 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-amber-700 transition"
          >
            💬 WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      token={token}
      displayName={init.displayName}
      officeName={init.restaurantName}
      sidebarItems={RESTORAN_SIDEBAR}
      brandTitle={RESTORAN_BRAND_TITLE}
      brandIconCollapsed={RESTORAN_BRAND_ICON}
      accentColor={RESTORAN_ACCENT}
    >
      {children({ token, init })}
    </AdminLayout>
  );
}
