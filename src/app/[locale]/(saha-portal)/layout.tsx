/**
 * Saha portal route group layout — Faz 6.
 *
 * /tr/saha — saha satış elemanının mobil portalı. AppShell YOK (tam ekran
 * mobil). Auth + login ekranı sayfanın kendisinde (page.tsx) yönetilir;
 * burada sadece mobil-dostu zemin sarımı.
 */
import type { ReactNode } from "react";

export default function SahaPortalLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
