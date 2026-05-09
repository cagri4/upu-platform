"use client";

/**
 * BottomTabBar — mobile-first native app pattern.
 *
 * Mobile/tablet'te (md ekranı altı) ekranın altında sabit 5 sekme. Hibrit
 * yaklaşım: günlük en sık kullanılan 4 sektörel sayfa + 5. sekme "Daha"
 * sidebar drawer'ı açar (tüm menü item'larına erişim).
 *
 * Desktop'ta (md+) gizlenir; sol sidebar yeterli.
 *
 * Erişilebilirlik: aria-label per tab, aktif sekmede aria-current="page".
 */

import type { SidebarItem } from "@/components/admin-layout";
import { usePathname } from "next/navigation";

interface BottomTabBarProps {
  tabs: SidebarItem[];
  token: string | null;
  /** "Daha" / hamburger açma — sidebar drawer'ı tetikler. */
  onMore: () => void;
  accentClass: string; // örn "text-emerald-600"
}

export function BottomTabBar({ tabs, token, onMore, accentClass }: BottomTabBarProps) {
  const pathname = usePathname() || "";

  // En fazla 4 ana sekme + 1 "Daha" — toplam 5
  const visibleTabs = tabs.slice(0, 4);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      aria-label="Hızlı erişim"
    >
      <div className="grid grid-cols-5">
        {visibleTabs.map((item) => {
          const isActive = item.matchPath
            ? (pathname === item.matchPath || pathname.startsWith(item.matchPath + "/"))
            : false;
          // Token yoksa cookie session aktif — item.href("") absolute path döner
          // (örn /tr/panel?t= boş query). Layout cookie session ile devam eder.
          const href = item.href(token || "");
          return (
            <a
              key={item.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition ${
                isActive ? accentClass : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.iconSrc} alt="" className="w-6 h-6" />
              ) : (
                <span className="text-xl leading-none">{item.icon}</span>
              )}
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {item.label}
              </span>
            </a>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-label="Daha fazla menü"
          className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-slate-500 hover:text-slate-900 transition"
        >
          <span className="text-xl leading-none">⋯</span>
          <span className="text-[10px] font-medium leading-tight">Daha</span>
        </button>
      </div>
    </nav>
  );
}
