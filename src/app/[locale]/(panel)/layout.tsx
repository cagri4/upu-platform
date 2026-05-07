"use client";

/**
 * Emlak yönetim paneli route group layout.
 * - /api/panel/init ile token doğrulanır + displayName/officeName fetch
 * - AdminLayout (sidebar + topbar) sarımı uygulanır
 * - Token yoksa/expired ise full-screen hata gösterilir, child sayfa render edilmez
 *
 * Form sayfaları (mulkekle-form, profil-duzenle, musteri-ekle-form) bu group DIŞINDA
 * kalır — WA WebView'da full-screen pattern korunur.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";

type InitState = "loading" | "ready" | "error";

export default function PanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState("error"); setError("Link geçersiz."); return; }
    fetch(`/api/panel/init?t=${encodeURIComponent(token)}`)
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
            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg"
          >
            WhatsApp&apos;a dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout token={token} displayName={displayName} officeName={officeName}>
      {children}
    </AdminLayout>
  );
}
