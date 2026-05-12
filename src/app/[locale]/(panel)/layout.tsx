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

/**
 * Bottom tab item'larının tam kataloğu — kullanıcı /tr/panel-ayarlari'da
 * bu set arasından max 4 sekme seçer; localStorage `upu-bottom-tabs:emlak`
 * id listesi olarak tutulur. Default: ilk 4 (panelim/mulkler/musteriler/sozlesme).
 */
const EMLAK_TAB_CATALOG: Record<string, SidebarItem> = {
  panelim:    { id: "panelim",    label: "Panelim",     icon: "🏠", iconSrc: "/icons/emlak/panelim.png",    href: t => `/tr/panel?t=${encodeURIComponent(t)}`,         matchPath: "/tr/panel" },
  mulkler:    { id: "mulkler",    label: "Mülkler",     icon: "🏢", iconSrc: "/icons/emlak/mulkler.png",    href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}`,     matchPath: "/tr/mulklerim" },
  musteriler: { id: "musteriler", label: "Müşteriler",  icon: "👥", iconSrc: "/icons/emlak/musteriler.png", href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}`,  matchPath: "/tr/musterilerim" },
  sozlesme:   { id: "sozlesme",   label: "Sözleşmeler", icon: "📋", iconSrc: "/icons/emlak/sozlesme.png",   href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}`, matchPath: "/tr/sozlesmelerim" },
  sunumlar:   { id: "sunumlar",   label: "Sunumlar",    icon: "📊", iconSrc: "/icons/emlak/sunumlar.png",   href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}`,    matchPath: "/tr/sunumlarim" },
  takip:      { id: "takip",      label: "Takip",       icon: "🎯", iconSrc: "/icons/emlak/takip.png",      href: t => `/tr/takip?t=${encodeURIComponent(t)}`,         matchPath: "/tr/takip" },
  ara:        { id: "ara",        label: "Tara",        icon: "🔍", iconSrc: "/icons/emlak/ara.png",        href: t => `/tr/ara?t=${encodeURIComponent(t)}`,           matchPath: "/tr/ara" },
  takvim:     { id: "takvim",     label: "Takvim",      icon: "📅", iconSrc: "/icons/emlak/takvim.png",     href: t => `/tr/takvim?t=${encodeURIComponent(t)}`,        matchPath: "/tr/takvim" },
  profil:     { id: "profil",     label: "Profil",      icon: "👤", iconSrc: "/icons/emlak/profil.png",     href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`, matchPath: "/tr/profil-duzenle" },
  websitem:   { id: "websitem",   label: "Web Sitem",   icon: "🌐", iconSrc: "/icons/emlak/websitem.png",   href: t => `/api/panel/web-sitem?t=${encodeURIComponent(t)}` },
};

const DEFAULT_TAB_IDS = ["panelim", "mulkler", "musteriler", "sozlesme"];
const TABS_STORAGE_KEY = "upu-bottom-tabs:emlak";

function loadBottomTabs(): SidebarItem[] {
  if (typeof window === "undefined") {
    return DEFAULT_TAB_IDS.map((id) => EMLAK_TAB_CATALOG[id]).filter(Boolean);
  }
  try {
    const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
        const items = arr.slice(0, 4).map((id) => EMLAK_TAB_CATALOG[id]).filter(Boolean);
        if (items.length > 0) return items;
      }
    }
  } catch { /* yut */ }
  return DEFAULT_TAB_IDS.map((id) => EMLAK_TAB_CATALOG[id]).filter(Boolean);
}

type InitState = "loading" | "ready" | "error";

export default function PanelGroupLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  // Init fetch arka planda çalışır, displayName/officeName geldikçe topbar dolar.
  // Loading UI gösterilmez — AdminLayout chrome anında render, child page kendi
  // skeleton'unu gösterir (çift "Yükleniyor" sorunu için bu yapı). Sadece hard
  // auth fail durumunda error ekranı (rare; middleware genelde yakalar).
  const [state, setState] = useState<InitState>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [bottomTabs, setBottomTabs] = useState<SidebarItem[]>(() =>
    DEFAULT_TAB_IDS.map((id) => EMLAK_TAB_CATALOG[id]).filter(Boolean),
  );

  useEffect(() => {
    setBottomTabs(loadBottomTabs());
  }, []);

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

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
          <a
            href="https://wa.me/31644967207"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            WhatsApp&apos;a dön
          </a>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-4 leading-relaxed">
            💡 WhatsApp&apos;a döndükten sonra son gönderdiğim &quot;Panele Git&quot; butonuna tekrar dokunarak yeni bir bağlantı alabilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  // state === "loading" veya "ready" — her iki durumda da AdminLayout render edilir.
  // Loading'de displayName/officeName null; topbar avatar/ad fallback ("?") gösterir.
  // Ready'de ise data gelmiş olur, topbar dolar.
  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={officeName}
      tenantKey="emlak"
      bottomTabs={bottomTabs}
    >
      {children}
    </AdminLayout>
  );
}
