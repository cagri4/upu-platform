"use client";

/**
 * V3 TopBar — sticky üst bar, mobile hamburger + arama + sağ aksiyonlar.
 *
 * Sidebar mobile drawer kontrolü AppShell üzerinden geliyor — hamburger
 * tıklanınca onMobileToggle çağrılır.
 */

import { Bell, Menu, Search } from "lucide-react";

export interface TopBarProps {
  onMobileToggle: () => void;
  searchPlaceholder?: string;
  rightSlot?: React.ReactNode;
}

export function TopBar({
  onMobileToggle,
  searchPlaceholder = "Sipariş, bayi veya ürün ara...",
  rightSlot,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileToggle}
          aria-label="Menüyü aç"
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="h-9 w-80 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <button
          type="button"
          aria-label="Bildirimler"
          className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
