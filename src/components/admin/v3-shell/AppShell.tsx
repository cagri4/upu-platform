"use client";

/**
 * V3 AppShell — sidebar + topbar wrapper. Mobile drawer state burada.
 *
 * Çocuk içerik <main> içine girer, ana içerik padding'i (px-4 sm:px-6 lg:px-8 py-6).
 */

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export interface AppShellProps {
  locale: string;
  tenantName: string;
  userName: string;
  topBarRightSlot?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  locale,
  tenantName,
  userName,
  topBarRightSlot,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar
        locale={locale}
        tenantName={tenantName}
        userName={userName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="lg:ml-56">
        <TopBar
          onMobileToggle={() => setMobileOpen((v) => !v)}
          rightSlot={topBarRightSlot}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
